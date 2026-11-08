/**
 * Client flow shared by both directory holes: try the native macOS panel
 * first; when the Host says it is unavailable (remote or non-macOS Web host),
 * fall back to the in-app multi-folder dialog. One picked folder opens
 * directly; two or more create one combined workspace.
 *
 * @module dsh-multi-workspace/client/flow
 */
import * as React from 'react'
import type { DirectoryListing } from '../shared/listing.js'
import { MultiFolderDialog } from './dialog.js'
import { isPickUnavailable, messageOf } from './errors.js'
import type { Translate } from './translate.js'

/** Owner share of a directory-flow hole (declared by `ui-workspace`). */
export interface DirectoryFlowOwnerProps {
  /** True while a picking interaction is requested. */
  open: boolean
  /** True while the owner adopts a picked path. */
  busy: boolean
  /** Report the picked directory; the owner adopts it. */
  onPicked: (path: string) => void
  /** Report cancellation. */
  onCancel: () => void
  /** Report an interaction failure. */
  onError: (message: string) => void
}

/** Share injected into the flow occupant by `src/client/index.ts`. */
export interface FlowInjected {
  /** Localized prompt shown inside the native panel. */
  message: string
  /** Bound locale function. */
  t: Translate
  /** Open the native panel and report the picked paths (null on cancel). */
  pick: (message: string) => Promise<string[] | null>
  /** List one Host directory level for the in-app browser. */
  list: (path: string | null) => Promise<DirectoryListing>
  /** Materialize and register a combined workspace for two or more folders. */
  createCombined: (paths: readonly string[]) => Promise<{ path: string }>
}

/** Dialog phases; `checking` also covers the native panel and creation. */
type Phase = 'idle' | 'checking' | 'dialog'

/**
 * Renderless-native, dialog-on-Web flow occupant. Each rising `open` edge
 * runs exactly one attempt; a re-render never launches a second panel.
 * @param props - owner conversation plus the injected share.
 * @returns the dialog while the in-app browser is open, otherwise null.
 */
export function MultiWorkspaceFlow(
  props: DirectoryFlowOwnerProps & FlowInjected,
): React.ReactElement | null {
  const [phase, setPhase] = React.useState<Phase>('idle')
  const armed = React.useRef(false)
  const alive = React.useRef(true)
  const latest = React.useRef(props)
  latest.current = props

  React.useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  React.useEffect(() => {
    if (!props.open) {
      armed.current = false
      setPhase('idle')
      return
    }
    if (armed.current) return
    armed.current = true
    setPhase('checking')
    void (async () => {
      try {
        const paths = await props.pick(props.message)
        if (!alive.current) return
        if (paths === null || paths.length === 0) {
          latest.current.onCancel()
          return
        }
        const first = paths[0]
        if (paths.length === 1 && first !== undefined) {
          latest.current.onPicked(first)
          return
        }
        const created = await props.createCombined(paths)
        if (!alive.current) return
        latest.current.onPicked(created.path)
      } catch (error) {
        if (!alive.current) return
        if (isPickUnavailable(error)) {
          setPhase('dialog')
          return
        }
        latest.current.onError(messageOf(error))
        setPhase('idle')
      }
    })()
  }, [props.open, props.message, props.pick, props.createCombined])

  if (!props.open || phase !== 'dialog') return null

  return (
    <MultiFolderDialog
      list={props.list}
      t={props.t}
      busy={props.busy}
      onCancel={() => {
        setPhase('idle')
        latest.current.onCancel()
      }}
      onConfirm={async paths => {
        const first = paths[0]
        if (paths.length === 1 && first !== undefined) {
          latest.current.onPicked(first)
          return
        }
        const created = await props.createCombined(paths)
        if (alive.current) latest.current.onPicked(created.path)
      }}
    />
  )
}
