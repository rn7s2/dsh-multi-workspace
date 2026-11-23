/**
 * Client half of the multi-workspace plugin.
 *
 * It mounts the `multiWorkspace` Typert Remote namespace, registers the
 * plugin's locale dictionaries, and occupies both directory-flow holes that
 * `ui-workspace` declares. From then on the sidebar "Add workspace" action and
 * the Prompt-above workspace menu's "Add workspace…" item open the native
 * macOS multi-folder panel on a local desktop, or the plugin's in-app
 * multi-folder browser on a remote or non-macOS host.
 *
 * One picked folder keeps the original behavior: the owner adopts that folder
 * directly. Two or more are materialized and registered by the Host half.
 *
 * @module dsh-multi-workspace/client
 */
import type * as React from 'react'
import { NS, en, zh } from './locale.js'
import { TYPERT_REMOTE } from './remote.js'
import { RemoteCallError } from './errors.js'
import { MultiWorkspaceFlow } from './flow.js'
import type { FlowInjected } from './flow.js'
import type { DirectoryListing } from '../shared/listing.js'
import { MIN_MEMBERS, type WorkspaceCreateRequest, type WorkspaceCreateResult, type WorkspaceInfo, type WorkspaceUpdateResult } from '../shared/rpc.js'
import { HARD_MAX_PATHS } from '../shared/naming.js'
import { FoldersSurface } from './manage.js'
import type { FoldersSurfaceInjected } from './manage.js'
import { openFoldersRequest } from './requests.js'

/**
 * Required Client services. The Workspace menu is deliberately absent: the
 * folder-editing rows are an addition, so a harness without its context-menu
 * service still loads this plugin and keeps creating workspaces.
 */
export const inject = ['slots', 'locale', 'remote']

/** One `RemoteResult` branch of a generated Client Remote call. */
type RemoteResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

/** The generated Client namespace service for this contribution. */
interface MultiWorkspaceRemoteNamespace {
  pick(message: string): Promise<RemoteResult<string[] | null>>
  list(path: string | null): Promise<RemoteResult<DirectoryListing>>
  create(request: WorkspaceCreateRequest): Promise<RemoteResult<WorkspaceCreateResult>>
  inspect(request: { path: string }): Promise<RemoteResult<WorkspaceInfo | null>>
  addFolders(request: { path: string; paths: string[] }): Promise<RemoteResult<WorkspaceUpdateResult>>
  removeFolders(request: { path: string; names: string[] }): Promise<RemoteResult<WorkspaceUpdateResult>>
}

/** One row a feature contributes to a context menu for a captured target. */
interface MenuActionLike {
  id: string
  label: string
  disabled?: boolean
  danger?: boolean
  separatorBefore?: boolean
  run?: () => void | Promise<void>
}

/** The minimal context-menu service face this plugin registers into. */
interface ContextMenusLike {
  register(contribution: {
    id: string
    target: 'workspace'
    order: number
    resolve: (
      target: { workspaceId: string; path: string; displayTitle: string },
      signal: AbortSignal,
    ) => readonly MenuActionLike[] | Promise<readonly MenuActionLike[]>
  }): () => void
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
    register(
      options: {
        name: string
        id?: string
        key?: string
        order?: number
        label?: string
        locale?: string
        inject?: () => object
      },
      component: (props: never) => React.ReactElement | null,
    ): unknown
  }
  locale: {
    register(namespace: string, locale: string, dictionary: Record<string, string>): () => void
    bind(namespace: string): Translate
  }
  remote: ClientRemoteService
  /** Read a service without declaring it in `inject` (used for the mounted namespace). */
  get(name: string): unknown
  /** Register a callback that runs once the given services exist. */
  inject(dependencies: string[], callback: (scope: { contextMenus: ContextMenusLike }) => (() => void) | void): () => void
  effect(callback: () => (() => void) | void, label?: string): () => void
}

/**
 * Unwrap one Remote result, preserving its business code.
 * @param call - Remote call to await.
 * @returns the success value.
 * @throws {RemoteCallError} when the Host answered with a failure.
 */
async function unwrap<T>(call: () => Promise<RemoteResult<T>>): Promise<T> {
  const result = await call()
  if (result.ok) return result.value
  throw new RemoteCallError(result.error.code, result.error.message)
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
  }, 'multi-workspace: picker dictionaries')

  const translate = ctx.locale.bind(NS)
  const message = translate('picker.message')

  // `remote.multiWorkspace` is mounted by the contribution above, so it cannot
  // be named in the plugin's `inject` list (that would deadlock activation).
  // Read it through `ctx.get()` at call time instead.
  const namespace = (): MultiWorkspaceRemoteNamespace => {
    const service = ctx.get('remote.multiWorkspace') as MultiWorkspaceRemoteNamespace | undefined
    if (service === undefined) throw new Error('multiWorkspace Remote namespace is unavailable')
    return service
  }

  const pick = (prompt: string): Promise<string[] | null> =>
    unwrap(() => namespace().pick(prompt))

  const list = (path: string | null): Promise<DirectoryListing> =>
    unwrap(() => namespace().list(path))

  const createCombined = (paths: readonly string[]): Promise<WorkspaceCreateResult> =>
    unwrap(() => namespace().create({ paths: [...paths] }))

  const inspect = (path: string): Promise<WorkspaceInfo | null> =>
    unwrap(() => namespace().inspect({ path }))

  const addFolders = (path: string, paths: readonly string[]): Promise<WorkspaceUpdateResult> =>
    unwrap(() => namespace().addFolders({ path, paths: [...paths] }))

  const removeFolders = (path: string, names: readonly string[]): Promise<WorkspaceUpdateResult> =>
    unwrap(() => namespace().removeFolders({ path, names: [...names] }))

  const injected = (): FlowInjected => ({
    pick,
    list,
    createCombined,
    message,
    t: translate,
  })

  const surfaceInjected = (): FoldersSurfaceInjected => ({
    t: translate,
    message: translate('manage.pickMessage'),
    pick,
    list,
    addFolders,
    removeFolders,
  })

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

  // Workspace menu rows: both are additive data contributions, so the shipped
  // Rename / Delete rows stay exactly where they are. The callback runs only
  // while the optional context-menu service is present, and its registration
  // is disposed with the injection it was made under.
  ctx.effect(
    () =>
      ctx.inject(['contextMenus'], scope => scope.contextMenus.register({
        id: 'multi-workspace.folders',
        target: 'workspace',
        order: 120,
        resolve: async target => {
          let info: WorkspaceInfo | null
          try {
            info = await inspect(target.path)
          } catch {
            // An ordinary workspace has no manifest: no rows, no noise.
            return []
          }
          if (info === null) return []
          const rows: MenuActionLike[] = []
          if (info.members.length < HARD_MAX_PATHS) {
            rows.push({
              id: 'add-folders',
              label: translate('menu.add'),
              run: () => {
                openFoldersRequest({ kind: 'add', path: info.path, title: info.title, members: info.members })
              },
            })
          }
          if (info.members.length > MIN_MEMBERS) {
            rows.push({
              id: 'remove-folders',
              label: translate('menu.remove'),
              run: () => {
                openFoldersRequest({
                  kind: 'remove',
                  path: info.path,
                  title: info.title,
                  members: info.members,
                })
              },
            })
          }
          return rows
        },
      })),
    'multi-workspace: workspace menu rows',
  )

  // The surfaces those rows raise live in the frame-wide layer so they outlive
  // the menu that opened them.
  const disposeSurface = ctx.effect(
    () =>
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          { name: 'shell.overlay', id: 'multi-workspace.folders', inject: surfaceInjected },
          FoldersSurface as (props: never) => React.ReactElement | null,
        ),
      ),
    'multi-workspace: folders surface',
  )

  return async () => {
    disposeSurface()
    disposeSlots()
    disposeLocale()
    await disposeRemote()
  }
}
