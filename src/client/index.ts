/**
 * Client half of the multi-workspace plugin.
 *
 * It mounts the `multiWorkspace` Typert Remote namespace, registers the native
 * picker prompt's locale dictionary, and occupies both directory-flow holes
 * that `ui-workspace` declares. From then on the sidebar "Add workspace"
 * action and the Prompt-above workspace menu's "Add workspace…" item open the
 * native macOS multi-folder panel instead of the shipped single-directory
 * chooser.
 *
 * One picked folder keeps the original behavior: the owner adopts that folder
 * directly. Two or more are materialized and registered by the Host half.
 *
 * @module dsh-multi-workspace/client
 */
import * as React from 'react'
import { NS, en, zh } from './locale.js'
import { TYPERT_REMOTE } from './remote.js'
import type { WorkspaceCreateRequest, WorkspaceCreateResult } from '../shared/rpc.js'

/** Required Client services. */
export const inject = ['slots', 'locale', 'remote']

/** Owner share of a directory-flow hole (declared by `ui-workspace`). */
interface DirectoryFlowOwnerProps {
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

/** One `RemoteResult` branch of a generated Client Remote call. */
type RemoteResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

/** The generated Client namespace service for this contribution. */
interface MultiWorkspaceRemoteNamespace {
  pick(message: string): Promise<RemoteResult<string[] | null>>
  create(request: WorkspaceCreateRequest): Promise<RemoteResult<WorkspaceCreateResult>>
}

/** The Client `remote` service face this plugin uses. */
interface ClientRemoteService {
  $mount(contribution: unknown): Promise<() => Promise<void> | void>
}

/** Bound translation function. */
type Translate = (key: string, params?: Record<string, string | number>) => string

/** The minimal Client Cordis surface this plugin uses (no runtime import needed). */
interface ClientContext {
  slots: {
    inject(key: string, callback: () => unknown): () => void
    register(options: { name: string; inject?: () => object }, component: (props: never) => React.ReactElement | null): unknown
  }
  locale: {
    register(namespace: string, locale: string, dictionary: Record<string, string>): () => void
    bind(namespace: string): Translate
  }
  remote: ClientRemoteService
  /** Read a service without declaring it in `inject` (used for the mounted namespace). */
  get(name: string): unknown
  effect(callback: () => (() => void) | void, label?: string): () => void
}

/** Injected share of the flow occupant. */
interface FlowInjected {
  /** Localized prompt shown inside the native panel. */
  message: string
  /** Open the native panel and report the picked paths (null on cancel). */
  pick: (message: string) => Promise<string[] | null>
  /** Materialize and register a combined workspace for two or more folders. */
  createCombined: (paths: readonly string[]) => Promise<WorkspaceCreateResult>
}

/**
 * Renderless flow occupant: each rising `open` edge runs exactly one pick and
 * reports exactly one outcome. A re-render (or the owner's adoption keeping
 * `open` true while `busy`) never launches a second panel; withdrawing `open`
 * re-arms the next request.
 * @param props - owner conversation plus the injected share.
 * @returns nothing — the native panel renders on the Host display.
 */
function MultiWorkspaceFlow(props: DirectoryFlowOwnerProps & FlowInjected): React.ReactElement | null {
  const armed = React.useRef(false)
  const outcome = React.useRef(props)
  outcome.current = props
  const alive = React.useRef(true)
  React.useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  React.useEffect(() => {
    if (!props.open) {
      armed.current = false
      return
    }
    if (armed.current) return
    armed.current = true
    void (async () => {
      try {
        const paths = await props.pick(props.message)
        if (!alive.current) return
        if (paths === null || paths.length === 0) {
          outcome.current.onCancel()
          return
        }
        const first = paths[0]
        if (paths.length === 1 && first !== undefined) {
          outcome.current.onPicked(first)
          return
        }
        const created = await props.createCombined(paths)
        if (!alive.current) return
        outcome.current.onPicked(created.path)
      } catch (error) {
        if (!alive.current) return
        outcome.current.onError(error instanceof Error ? error.message : String(error))
      }
    })()
  }, [props.open, props.message, props.pick, props.createCombined])
  return null
}

/**
 * Client plugin entry.
 * @param context - the owning Client plugin context.
 * @returns a disposer after the mounted Remote contribution and slot entries.
 */
export async function apply(context: unknown): Promise<() => Promise<void>> {
  const ctx = context as ClientContext

  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE)

  const disposeLocale = ctx.effect(() => {
    const disposers: (() => void)[] = []
    try {
      disposers.push(ctx.locale.register(NS, 'zh', zh))
      disposers.push(ctx.locale.register(NS, 'en', en))
    } catch (error) {
      for (const dispose of disposers.reverse()) dispose()
      throw error
    }
    return () => {
      for (const dispose of disposers.reverse()) dispose()
    }
  }, 'multi-workspace: native picker dictionary')

  const message = ctx.locale.bind(NS)('picker.message')

  // `remote.multiWorkspace` is mounted by the contribution above, so it cannot
  // be named in the plugin's `inject` list (that would deadlock activation).
  // Read it through `ctx.get()` at call time instead.
  const namespace = (): MultiWorkspaceRemoteNamespace => {
    const service = ctx.get('remote.multiWorkspace') as MultiWorkspaceRemoteNamespace | undefined
    if (service === undefined) throw new Error('multiWorkspace Remote namespace is unavailable')
    return service
  }

  const pick = async (prompt: string): Promise<string[] | null> => {
    const result = await namespace().pick(prompt)
    if (result.ok) return result.value
    throw new Error(result.error.message)
  }

  const createCombined = async (paths: readonly string[]): Promise<WorkspaceCreateResult> => {
    const result = await namespace().create({ paths: [...paths] })
    if (result.ok) return result.value
    throw new Error(result.error.message)
  }

  const injected = (): FlowInjected => ({ pick, createCombined, message })

  const disposeSlots = ctx.effect(
    () =>
      ctx.slots.inject('conversation.hero.workspace.directoryFlow', () =>
        ctx.slots.inject('sidebar.workspaces.directoryFlow', function* () {
          yield ctx.slots.register(
            { name: 'conversation.hero.workspace.directoryFlow', inject: injected },
            MultiWorkspaceFlow as (props: never) => React.ReactElement | null,
          )
          yield ctx.slots.register(
            { name: 'sidebar.workspaces.directoryFlow', inject: injected },
            MultiWorkspaceFlow as (props: never) => React.ReactElement | null,
          )
        }),
      ),
    'multi-workspace: directory-flow occupants',
  )

  return async () => {
    disposeSlots()
    disposeLocale()
    await disposeRemote()
  }
}
