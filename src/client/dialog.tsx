/**
 * In-app multi-folder browser for hosts that cannot show an operating-system
 * panel (the Web profile on a remote or non-macOS machine).
 *
 * The dialog lists one directory level at a time through the Host's
 * `multiWorkspace/list` method, accumulates folders in pick order, and hands
 * the complete selection to the flow. One folder keeps stock behavior (open
 * it directly); two or more become one combined workspace.
 *
 * @module dsh-multi-workspace/client/dialog
 */
import * as React from 'react'
import { createPortal } from 'react-dom'
import type { DirectoryEntry, DirectoryListing } from '../shared/listing.js'
import { HARD_MAX_PATHS } from '../shared/naming.js'
import { messageOf } from './errors.js'
import { removeSelection, selectionHas, selectionPaths, toggleSelection } from './selection.js'
import type { Translate } from './translate.js'

/** Props of the in-app browser. */
export interface MultiFolderDialogProps {
  /** List one Host directory level; absent lists the Host home directory. */
  list: (path: string | null) => Promise<DirectoryListing>
  /** Bound locale function. */
  t: Translate
  /** The workspace owner is adopting a picked path; freeze the dialog. */
  busy: boolean
  /** Create the workspace (one folder opens it directly) or report a failure. */
  onConfirm: (paths: readonly string[]) => Promise<void>
  /** Dismiss without picking. */
  onCancel: () => void
}

/** Inline styles; theme tokens keep light and dark modes coherent. */
const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.45)',
    padding: 16,
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    width: 'min(620px, calc(100vw - 32px))',
    maxHeight: 'min(78vh, 720px)',
    background: 'var(--dsw-alias-bg-overlay, #ffffff)',
    color: 'var(--dsw-alias-label-primary, #1f1f1f)',
    border: '1px solid var(--dsw-alias-border-l2, #d0d0d0)',
    borderRadius: 12,
    boxShadow: '0 18px 50px rgba(0, 0, 0, 0.35)',
    font: 'inherit',
    outline: 'none',
  },
  header: {
    padding: '16px 20px 0',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
  },
  subtitle: {
    margin: '6px 0 0',
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-secondary, #666)',
  },
  breadcrumb: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
    padding: '10px 20px',
    borderBottom: '1px solid var(--dsw-alias-border-l1, #e5e5e5)',
    fontSize: 12,
    color: 'var(--dsw-alias-label-secondary, #666)',
  },
  crumb: {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    padding: '2px 4px',
    borderRadius: 4,
    cursor: 'pointer',
  },
  separator: {
    opacity: 0.5,
    padding: '0 2px',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 20px',
    borderBottom: '1px solid var(--dsw-alias-border-l1, #e5e5e5)',
    fontSize: 12,
  },
  hiddenToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    userSelect: 'none',
  },
  refresh: {
    border: '1px solid var(--dsw-alias-border-l1, #ddd)',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    padding: '3px 10px',
    borderRadius: 6,
    cursor: 'pointer',
  },
  list: {
    flex: '1 1 auto',
    minHeight: 180,
    overflowY: 'auto',
    padding: '6px 10px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    borderRadius: 6,
  },
  checkbox: {
    margin: 0,
    cursor: 'pointer',
    accentColor: 'var(--dsw-alias-brand-primary, #3b82f6)',
  },
  name: {
    flex: '1 1 auto',
    minWidth: 0,
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontSize: 13,
    padding: '4px 0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  hiddenNote: {
    fontSize: 11,
    opacity: 0.6,
  },
  status: {
    padding: '16px 12px',
    fontSize: 12,
    color: 'var(--dsw-alias-label-secondary, #666)',
    textAlign: 'center',
  },
  error: {
    margin: '8px 12px',
    padding: '8px 10px',
    fontSize: 12,
    color: 'var(--dsw-alias-state-error-primary, #cc3344)',
    background: 'var(--dsw-alias-bg-layer-2, #f7f7f7)',
    borderRadius: 6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  selected: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    padding: '8px 20px',
    borderTop: '1px solid var(--dsw-alias-border-l1, #e5e5e5)',
    fontSize: 12,
  },
  selectedLabel: {
    color: 'var(--dsw-alias-label-secondary, #666)',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    padding: '2px 6px 2px 8px',
    border: '1px solid var(--dsw-alias-border-l1, #ddd)',
    borderRadius: 999,
    background: 'var(--dsw-alias-bg-layer-2, #f5f5f5)',
  },
  chipName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 180,
  },
  chipRemove: {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    lineHeight: 1,
    padding: '0 2px',
    cursor: 'pointer',
    opacity: 0.75,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '12px 20px 16px',
  },
  button: {
    border: '1px solid var(--dsw-alias-border-l1, #ddd)',
    background: 'var(--dsw-alias-bg-layer-2, #f5f5f5)',
    color: 'inherit',
    font: 'inherit',
    fontSize: 13,
    padding: '7px 14px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  primary: {
    border: '1px solid transparent',
    background: 'var(--dsw-alias-brand-primary, #3b82f6)',
    color: '#ffffff',
    font: 'inherit',
    fontSize: 13,
    fontWeight: 500,
    padding: '7px 14px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  capNote: {
    color: 'var(--dsw-alias-state-warn-primary, #a15c00)',
  },
} satisfies Record<string, React.CSSProperties>

/**
 * Render the dialog over the application shell.
 * @param props - listing call, locale, owner busy state, and outcomes.
 * @returns the dialog element, or null when no document is available.
 */
export function MultiFolderDialog(props: MultiFolderDialogProps): React.ReactElement | null {
  const { list, t, busy, onConfirm, onCancel } = props
  const [listing, setListing] = React.useState<DirectoryListing | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showHidden, setShowHidden] = React.useState(false)
  const [selected, setSelected] = React.useState<DirectoryEntry[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const request = React.useRef(0)
  const panel = React.useRef<HTMLDivElement | null>(null)
  const titleId = React.useId()
  const disabled = submitting || busy

  const load = React.useCallback(
    async (path?: string): Promise<void> => {
      const seq = (request.current += 1)
      setLoading(true)
      setError(null)
      setListing(null)
      try {
        const next = await list(path ?? null)
        if (seq !== request.current) return
        setListing(next)
      } catch (failure) {
        if (seq !== request.current) return
        setError(messageOf(failure))
      } finally {
        if (seq === request.current) setLoading(false)
      }
    },
    [list],
  )

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    panel.current?.focus()
  }, [])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !disabled) {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [disabled, onCancel])

  const visible = React.useMemo(
    () => (listing === null ? [] : listing.entries.filter(entry => showHidden || !entry.hidden)),
    [listing, showHidden],
  )

  const toggle = (entry: DirectoryEntry): void => {
    if (disabled) return
    setSelected(current => toggleSelection(current, entry))
  }

  const confirm = async (): Promise<void> => {
    if (disabled) return
    const paths = selectionPaths(selected)
    if (paths.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(paths)
    } catch (failure) {
      setError(messageOf(failure))
      setSubmitting(false)
    }
  }

  if (typeof document === 'undefined') return null
  const confirmLabel = submitting
    ? t('dialog.creating')
    : selected.length === 1
      ? t('dialog.open')
      : t('dialog.create')
  const crumbButtons =
    listing === null
      ? []
      : listing.crumbs.filter(crumb => crumb.path !== listing.home)

  return createPortal(
    <div
      style={styles.overlay}
      onMouseDown={event => {
        if (event.target === event.currentTarget && !disabled) onCancel()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={styles.panel}
        onMouseDown={event => event.stopPropagation()}
      >
        <div style={styles.header}>
          <h2 id={titleId} style={styles.title}>
            {t('dialog.title')}
          </h2>
          <p style={styles.subtitle}>{t('dialog.subtitle')}</p>
        </div>

        <div style={styles.breadcrumb}>
          <button
            type="button"
            style={styles.crumb}
            disabled={disabled}
            onClick={() => void load(listing?.home)}
          >
            {t('dialog.home')}
          </button>
          {crumbButtons.map(crumb => (
            <React.Fragment key={crumb.path}>
              <span style={styles.separator}>/</span>
              <button
                type="button"
                style={styles.crumb}
                disabled={disabled}
                title={crumb.path}
                onClick={() => void load(crumb.path)}
              >
                {crumb.path === listing?.crumbs[0]?.path ? t('dialog.root') : crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div style={styles.controls}>
          <label style={styles.hiddenToggle}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={showHidden}
              disabled={disabled}
              onChange={event => setShowHidden(event.currentTarget.checked)}
            />
            {t('dialog.hidden')}
          </label>
          <button
            type="button"
            style={styles.refresh}
            disabled={disabled || loading}
            onClick={() => void load(listing?.path)}
          >
            {t('dialog.refresh')}
          </button>
        </div>

        <div style={styles.list}>
          {loading ? <div style={styles.status}>{t('dialog.loading')}</div> : null}
          {error !== null ? (
            <div role="alert" style={styles.error}>
              {error}
            </div>
          ) : null}
          {!loading && error === null && visible.length === 0 ? (
            <div style={styles.status}>{t('dialog.empty')}</div>
          ) : null}
          {!loading && error === null
            ? visible.map(entry => (
                <div key={entry.path} style={styles.row}>
                  <input
                    type="checkbox"
                    style={styles.checkbox}
                    checked={selectionHas(selected, entry.path)}
                    disabled={disabled}
                    aria-label={entry.name}
                    onChange={() => toggle(entry)}
                  />
                  <button
                    type="button"
                    style={styles.name}
                    disabled={disabled}
                    title={entry.path}
                    onClick={() => void load(entry.path)}
                  >
                    {entry.name}
                  </button>
                  {entry.hidden ? <span style={styles.hiddenNote}>{t('dialog.hiddenTag')}</span> : null}
                </div>
              ))
            : null}
          {!loading && listing?.truncated === true ? (
            <div style={styles.status}>{t('dialog.truncated')}</div>
          ) : null}
        </div>

        {selected.length > 0 ? (
          <div style={styles.selected}>
            <span style={styles.selectedLabel}>{t('dialog.selected', { count: selected.length })}</span>
            {selected.map(entry => (
              <span key={entry.path} style={styles.chip} title={entry.path}>
                <span style={styles.chipName}>{entry.name}</span>
                <button
                  type="button"
                  style={styles.chipRemove}
                  disabled={disabled}
                  aria-label={t('dialog.remove', { name: entry.name })}
                  onClick={() => setSelected(current => removeSelection(current, entry.path))}
                >
                  ×
                </button>
              </span>
            ))}
            {selected.length >= HARD_MAX_PATHS ? (
              <span style={styles.capNote}>{t('dialog.max')}</span>
            ) : null}
          </div>
        ) : null}

        <div style={styles.footer}>
          <button type="button" style={styles.button} disabled={disabled} onClick={onCancel}>
            {t('dialog.cancel')}
          </button>
          <button
            type="button"
            style={{ ...styles.primary, ...(disabled || selected.length === 0 ? styles.disabled : {}) }}
            disabled={disabled || selected.length === 0}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
