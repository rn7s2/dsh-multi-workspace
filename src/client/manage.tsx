/**
 * Frame-wide surface for editing a combined workspace's folder set: the
 * append flow (native panel first, in-app browser as the fallback) and the
 * removal dialog. Both are raised from the Workspace menu rows, which run
 * outside React, so they read the shared request store and settle it once.
 *
 * A failed attempt never discards the operator's work: the browser keeps the
 * selection and shows the failure above the footer, and a failed native
 * attempt offers another run instead of closing.
 *
 * @module dsh-multi-workspace/client/manage
 */
import * as React from 'react'
import { createPortal } from 'react-dom'
import type { DirectoryListing } from '../shared/listing.js'
import { MIN_MEMBERS, type WorkspaceMemberInfo } from '../shared/rpc.js'
import { MultiFolderDialog, panelStyles } from './dialog.js'
import { isPickUnavailable, messageOf } from './errors.js'
import { closeFoldersRequest, useFoldersRequest } from './requests.js'
import type { Translate } from './translate.js'

/** What the surface needs from the plugin's Client half. */
export interface FoldersSurfaceInjected {
  /** Bound locale function. */
  t: Translate
  /** Localized prompt shown inside the native panel. */
  message: string
  /** Open the native panel and report the picked paths (null on cancel). */
  pick: (message: string) => Promise<string[] | null>
  /** List one Host directory level for the in-app browser. */
  list: (path: string | null) => Promise<DirectoryListing>
  /** Append folders to a combined workspace. */
  addFolders: (path: string, paths: readonly string[]) => Promise<{ title: string }>
  /** Remove members from a combined workspace. */
  removeFolders: (path: string, names: readonly string[]) => Promise<{ title: string }>
}

/** One captured request, as the surface receives it. */
interface SurfaceRequest {
  readonly path: string
  readonly title: string
  readonly members: readonly WorkspaceMemberInfo[]
}

/** Phases of the append flow; `native` renders nothing while the panel is up. */
type AddPhase = 'native' | 'browser' | 'native-failed'

/**
 * The one overlay that renders both edit surfaces.
 * @param props - locale, picker, and mutation calls.
 * @returns the active surface, or null when no request is open.
 */
export function FoldersSurface(props: FoldersSurfaceInjected): React.ReactElement | null {
  const request = useFoldersRequest()
  if (request === null) return null
  return request.kind === 'add' ? (
    <AppendSurface key={`add:${request.path}`} request={request} {...props} />
  ) : (
    <RemoveSurface key={`remove:${request.path}`} request={request} {...props} />
  )
}

/** Append flow: native panel, then the in-app browser. */
function AppendSurface(
  props: FoldersSurfaceInjected & { request: SurfaceRequest },
): React.ReactElement | null {
  const { t, message, pick, list, addFolders, request } = props
  const [phase, setPhase] = React.useState<AddPhase>('native')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [attempt, setAttempt] = React.useState(0)
  const alive = React.useRef(true)
  const started = React.useRef(-1)

  React.useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const append = React.useCallback(
    async (paths: readonly string[]): Promise<void> => {
      setBusy(true)
      setError(null)
      try {
        await addFolders(request.path, paths)
        closeFoldersRequest()
      } catch (failure) {
        // Keep whatever is on screen: the browser still holds the selection.
        if (!alive.current) return
        setError(messageOf(failure))
        setBusy(false)
        setPhase(current => (current === 'native' ? 'native-failed' : current))
      }
    },
    [addFolders, request.path],
  )

  React.useEffect(() => {
    if (phase !== 'native' || started.current === attempt) return
    started.current = attempt
    void (async () => {
      try {
        const paths = await pick(message)
        if (!alive.current) return
        if (paths === null || paths.length === 0) {
          closeFoldersRequest()
          return
        }
        await append(paths)
      } catch (failure) {
        if (!alive.current) return
        if (isPickUnavailable(failure)) {
          setPhase('browser')
          return
        }
        setError(messageOf(failure))
        setPhase('native-failed')
      }
    })()
  }, [attempt, phase, append, message, pick])

  if (phase === 'native') return null
  if (phase === 'native-failed') {
    return (
      <Notice
        title={t('manage.add.title')}
        error={error}
        t={t}
        onRetry={() => {
          setError(null)
          setPhase('native')
          setAttempt(value => value + 1)
        }}
      />
    )
  }

  return (
    <MultiFolderDialog
      list={list}
      t={t}
      busy={busy}
      onCancel={closeFoldersRequest}
      onConfirm={async paths => {
        await append(paths)
      }}
      overrides={{
        title: t('manage.add.heading', { name: request.title }),
        subtitle: t('manage.add.subtitle'),
        confirm: t('manage.add.confirm'),
        pending: t('manage.add.pending'),
        error,
        exclude: request.members.map(member => member.target),
      }}
    />
  )
}

/** Removal flow: pick members to drop, never below the two-folder floor. */
function RemoveSurface(
  props: FoldersSurfaceInjected & { request: SurfaceRequest },
): React.ReactElement | null {
  const { t, removeFolders, request } = props
  const [chosen, setChosen] = React.useState<readonly string[]>([])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const remaining = request.members.length - chosen.length
  const blocked = busy || chosen.length === 0 || remaining < MIN_MEMBERS
  const busyMembers = request.members.filter(member => member.inUse === true && chosen.includes(member.name))
  const titleId = React.useId()

  const toggle = (name: string): void => {
    if (busy) return
    setChosen(current =>
      current.includes(name) ? current.filter(entry => entry !== name) : [...current, name],
    )
  }

  const confirm = async (): Promise<void> => {
    if (blocked) return
    setBusy(true)
    setError(null)
    try {
      await removeFolders(request.path, chosen)
      closeFoldersRequest()
    } catch (failure) {
      setError(messageOf(failure))
      setBusy(false)
    }
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div style={panelStyles.overlay}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} style={panelStyles.panel}>
        <div style={panelStyles.header}>
          <h2 id={titleId} style={panelStyles.title}>
            {t('manage.remove.heading', { name: request.title })}
          </h2>
          <p style={panelStyles.subtitle}>{t('manage.remove.subtitle')}</p>
        </div>
        <div style={panelStyles.list}>
          {request.members.map(member => (
            <label
              key={member.name}
              style={{ ...panelStyles.row, cursor: busy ? 'default' : 'pointer' }}
            >
              <input
                type="checkbox"
                style={panelStyles.checkbox}
                checked={chosen.includes(member.name)}
                disabled={busy}
                aria-label={member.name}
                onChange={() => toggle(member.name)}
              />
              <span style={{ ...panelStyles.name, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {member.name}
              </span>
              <span
                style={{
                  ...panelStyles.hiddenNote,
                  maxWidth: 240,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={member.target}
              >
                {member.target}
              </span>
              {member.inUse === true ? (
                <span style={panelStyles.capNote}>{t('manage.remove.inUseTag')}</span>
              ) : null}
            </label>
          ))}
        </div>
        {busyMembers.length > 0 ? (
          <div role="alert" style={panelStyles.error}>
            {t('manage.remove.inUseWarning', {
              names: busyMembers.map(member => member.name).join(', '),
            })}
          </div>
        ) : null}
        {remaining < MIN_MEMBERS ? (
          <div role="alert" style={panelStyles.error}>
            {t('manage.remove.minimum', { count: MIN_MEMBERS })}
          </div>
        ) : null}
        {error !== null ? (
          <div role="alert" style={panelStyles.error}>
            {error}
          </div>
        ) : null}
        <div style={panelStyles.footer}>
          <button type="button" style={panelStyles.button} disabled={busy} onClick={closeFoldersRequest}>
            {t('manage.cancel')}
          </button>
          <button
            type="button"
            style={{ ...panelStyles.primary, ...(blocked ? panelStyles.disabled : {}) }}
            disabled={blocked}
            onClick={() => void confirm()}
          >
            {busy ? t('manage.remove.pending') : t('manage.remove.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Compact failure notice for the native panel, with one more attempt. */
function Notice(props: {
  title: string
  error: string | null
  t: Translate
  onRetry: () => void
}): React.ReactElement | null {
  const { title, error, t, onRetry } = props
  const titleId = React.useId()
  if (typeof document === 'undefined') return null
  return createPortal(
    <div style={panelStyles.overlay}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} style={panelStyles.panel}>
        <div style={panelStyles.header}>
          <h2 id={titleId} style={panelStyles.title}>
            {title}
          </h2>
        </div>
        <div role="alert" style={panelStyles.error}>
          {error ?? t('manage.failed')}
        </div>
        <div style={panelStyles.footer}>
          <button type="button" style={panelStyles.button} onClick={closeFoldersRequest}>
            {t('manage.close')}
          </button>
          <button type="button" style={panelStyles.primary} onClick={onRetry}>
            {t('manage.retry')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
