/**
 * Host half of the multi-workspace plugin.
 *
 * Mounted as a dependency-free plain ESM Cordis plugin: it registers one
 * `multiWorkspace` service through `ctx.provide()` and publishes a Typert
 * Remote manifest from `./typert`. The Client flow calls `multiWorkspace/pick`
 * for the native macOS multi-folder panel, `multiWorkspace/list` for the in-app
 * browser used by remote or non-macOS hosts, and `multiWorkspace/create` for
 * the combined workspace; this half materializes the real combined directory,
 * symlinks the picked folders into it, and registers the durable Workspace
 * through `ctx.workspaceRegistry`.
 *
 * @module dsh-multi-workspace/host
 */
import { realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve, sep } from 'node:path'
import { SelectionError } from './core.js'
import {
  addFolders,
  dissolveWorkspaceDirectory,
  materializeWorkspace,
  readCombinedWorkspaceWithin,
  removeFolders,
  syncWorkspaceTitle,
} from './fs.js'
import type { EditedWorkspace, MaterializedWorkspace } from './fs.js'
import { buildDirectoryListing, ListingError } from './listing.js'
import { nativePanelBlocker, pickNativeDirectories } from './native-picker.js'
import { registerCombinedWorkspaceGuidance, type SystemPromptLike } from './prompt.js'
import type { DirectoryListing } from '../shared/listing.js'
import {
  NAMESPACE,
  addRequestSchema,
  createRequestSchema,
  inspectRequestSchema,
  removeRequestSchema,
  type WorkspaceAddRequest,
  type WorkspaceCreateRequest,
  type WorkspaceCreateResult,
  type WorkspaceInfo,
  type WorkspaceInspectRequest,
  type WorkspaceRemoveRequest,
  type WorkspaceUpdateResult,
} from '../shared/rpc.js'

/** Configuration a composing row may pass to this plugin. */
export interface MultiWorkspaceConfig {
  /** Absolute directory that holds the real combined workspaces; defaults to `<dsh home>/multi-workspaces`. */
  rootDir?: string
}

/** The minimal Cordis surface this plugin uses (no runtime import needed). */
interface HostContext {
  provide(name: string, value: object): () => void
  get(name: string): unknown
  /** Cordis dependency-aware registration (used for the runtime context hook). */
  inject(dependencies: string[], callback: (scope: unknown) => void): void
  /** Cordis event subscription; absent in minimal test contexts. */
  on?(event: 'domain/changed', listener: (change: DomainChangedLike) => void): () => void
  /** Cordis logger; absent in minimal test contexts. */
  logger?: { warn?(message: string): void }
}

/** One durable-domain change, as far as this plugin inspects it. */
interface DomainChangedLike {
  readonly domain?: unknown
  readonly table?: unknown
  readonly key?: unknown
  readonly operation?: unknown
  readonly value?: unknown
}

/** The WorkingDirectory service surface the context provider reads. */
interface WorkingDirectoryLike {
  get(session: unknown): string
}

/** The durable Workspace entity surface this plugin relies on. */
interface WorkspaceEntityLike {
  readonly id: string
  readonly path: string
  readonly title: string
  readonly sessionIds?: readonly string[]
  setTitle?(title: string): Promise<void>
}

/** The Workspace registry service surface this plugin relies on. */
interface WorkspaceRegistryLike {
  create(path: string, title?: string): Promise<WorkspaceEntityLike>
  list(): readonly WorkspaceEntityLike[]
  resolveByPath(path: string): Promise<WorkspaceEntityLike | undefined>
}

/** Table name of the Workspace domain records. */
const WORKSPACE_TABLE = 'workspaces'

/** Domain name of the Workspace registry records. */
const WORKSPACE_DOMAIN = 'workspace'

/**
 * Read the Workspace registry when the composition provides it.
 * @param ctx - Host plugin context.
 * @returns the registry, or undefined in a composition without one.
 */
function registryOf(ctx: HostContext): WorkspaceRegistryLike | undefined {
  const registry = ctx.get('workspaceRegistry') as WorkspaceRegistryLike | undefined
  return registry !== undefined && typeof registry.create === 'function' ? registry : undefined
}

/**
 * Resolve the Workspace that owns a directory without creating one.
 * @param registry - live registry.
 * @param dir - absolute directory.
 * @returns the owning entity, or undefined for an unowned or unreadable path.
 */
async function ownedWorkspace(
  registry: WorkspaceRegistryLike | undefined,
  dir: string,
): Promise<WorkspaceEntityLike | undefined> {
  if (registry === undefined || typeof registry.resolveByPath !== 'function') return undefined
  try {
    return await registry.resolveByPath(dir)
  } catch {
    return undefined
  }
}

/**
 * A failure that crosses Typert Remote with a stable code and a user-facing
 * message. The structural marker is the same one the protocol's `RemoteError`
 * carries, so the Gateway forwards code/message/details unchanged.
 */
class RemoteFailure extends Error {
  readonly isDSHRemoteError = true
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'RemoteError'
    this.code = code
    this.details = details
  }
}

/**
 * Resolve the fixed directory that holds real combined workspaces.
 * @param configured - absolute override from the plugin row config.
 * @returns the absolute root directory.
 */
export function resolveWorkspaceRoot(configured: string | undefined): string {
  if (configured !== undefined && isAbsolute(configured)) return configured
  const configuredHome = process.env['DSH_HOME']?.trim()
  const dshHome =
    configuredHome !== undefined && configuredHome !== '' ? configuredHome : join(homedir(), '.dsh')
  return join(dshHome, 'multi-workspaces')
}

/** The `multiWorkspace` service this plugin provides. */
export interface MultiWorkspaceService {
  /** Typert Gateway binding; the Gateway validates this exact shape. */
  readonly typertRemote: { readonly service: MultiWorkspaceService; readonly serviceKey: string; readonly namespace: string }
  /**
   * Open the native macOS multi-folder panel.
   * @param message - prompt shown inside the panel.
   * @returns the picked absolute folder paths, or null when cancelled.
   * @throws {RemoteFailure} `multi-workspace/pick-unavailable` when this host
   *   cannot show a local macOS panel; the Client then opens its in-app browser.
   */
  pick(message: string): Promise<string[] | null>
  /**
   * List one directory level for the in-app browser.
   * @param path - absolute directory; null lists the host home directory.
   * @returns the bounded level and its ancestry.
   */
  list(path: string | null): Promise<DirectoryListing>
  /**
   * Create a combined workspace from two or more folders.
   * @param request - folder paths and an optional title override.
   * @returns the materialized directory and its durable registration.
   */
  create(request: WorkspaceCreateRequest): Promise<WorkspaceCreateResult>
  /**
   * Describe one combined workspace.
   * @param request - directory to inspect.
   * @returns the workspace, or null when the directory is not a combined workspace.
   */
  inspect(request: WorkspaceInspectRequest): Promise<WorkspaceInfo | null>
  /**
   * Append folders to a combined workspace.
   * @param request - the directory and the folders to link in.
   * @returns the updated workspace.
   */
  addFolders(request: WorkspaceAddRequest): Promise<WorkspaceUpdateResult>
  /**
   * Remove folders from a combined workspace, never touching their directories.
   * @param request - the directory and the members to drop.
   * @returns the updated workspace.
   */
  removeFolders(request: WorkspaceRemoveRequest): Promise<WorkspaceUpdateResult>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** One live Agent, as far as its Session directory matters here. */
interface LiveAgentLike {
  readonly session?: { readonly header?: { readonly cwd?: string } }
}

/** The live-Agent registry this plugin reads. */
interface AgentsLike {
  list(): readonly LiveAgentLike[]
}

/** Whether `cwd` is `dir` itself or sits below it. */
function contains(dir: string, cwd: string): boolean {
  if (cwd === dir) return true
  const prefix = dir.endsWith(sep) ? dir : `${dir}${sep}`
  return cwd.startsWith(prefix)
}

/**
 * Working directories of the sessions running now, in canonical spelling so
 * they can be matched against the canonical member targets.
 * @param ctx - Host plugin context.
 * @returns directories of live sessions; empty when no Agent service is present.
 */
async function liveWorkingDirectories(ctx: HostContext): Promise<string[]> {
  const agents = ctx.get('agents') as AgentsLike | undefined
  if (agents === undefined || typeof agents.list !== 'function') return []
  const workingDirectory = ctx.get('workingDirectory') as
    | { get(session: unknown): string }
    | undefined
  const directories: string[] = []
  let live: readonly LiveAgentLike[]
  try {
    live = agents.list()
  } catch {
    return []
  }
  for (const agent of live) {
    let cwd: unknown
    try {
      cwd =
        agent.session !== undefined &&
        workingDirectory !== undefined &&
        typeof workingDirectory.get === 'function'
          ? workingDirectory.get(agent.session)
          : agent.session?.header?.cwd
    } catch {
      cwd = agent.session?.header?.cwd
    }
    if (typeof cwd === 'string' && cwd !== '') {
      directories.push(await realpath(cwd).catch(() => cwd))
    }
  }
  return directories
}

/**
 * Titles of the other registered workspaces, used when an edit recomputes an
 * automatic title.
 * @param ctx - Host plugin context.
 * @returns the sibling titles, or an empty list without a registry.
 */
function siblingOptions(ctx: HostContext): { takenTitles: readonly string[] } {
  const registry = registryOf(ctx)
  if (registry === undefined || typeof registry.list !== 'function') return { takenTitles: [] }
  try {
    return { takenTitles: registry.list().map(workspace => workspace.title) }
  } catch {
    return { takenTitles: [] }
  }
}

/**
 * Run one membership edit, keep the durable Workspace title in step, and
 * project the result onto the wire shape.
 * @param ctx - Host plugin context.
 * @param rootDir - combined-workspace root.
 * @param run - the edit to perform.
 * @returns the updated workspace.
 * @throws {RemoteFailure} with the edit's rejection code.
 */
async function applyEdit(
  ctx: HostContext,
  rootDir: string,
  run: () => Promise<EditedWorkspace>,
): Promise<WorkspaceUpdateResult> {
  let edited: EditedWorkspace
  try {
    edited = await run()
  } catch (error) {
    if (error instanceof SelectionError) {
      throw new RemoteFailure('multi-workspace/invalid-selection', error.message, {
        reason: error.code,
      })
    }
    throw new RemoteFailure('multi-workspace/edit-failed', errorMessage(error))
  }
  const owner = await ownedWorkspace(registryOf(ctx), edited.workspace.dir)
  // Publish the title first, then record it. A publication that fails leaves
  // both sides on the previous automatic title, which is exactly what keeps a
  // later sync from mistaking a stale registry value for a manual choice.
  let title = edited.title
  let titleAuto = edited.titleAuto
  if (owner !== undefined && typeof owner.setTitle === 'function' && owner.title !== edited.title) {
    try {
      await owner.setTitle(edited.title)
    } catch (error) {
      // The member links are already correct; the title is cosmetic and the
      // next edit retries it, so the edit itself is still reported as done.
      ctx.logger?.warn?.(
        `multi-workspace: folders changed in "${edited.workspace.dir}" but the title update failed: ${errorMessage(error)}`,
      )
      title = owner.title
      titleAuto = edited.workspace.titleAuto
    }
  }
  if (title !== edited.workspace.title || titleAuto !== edited.workspace.titleAuto) {
    await syncWorkspaceTitle(edited.workspace.dir, title, titleAuto).catch(() => undefined)
  }
  return {
    path: edited.workspace.dir,
    title,
    titleAuto,
    members: edited.workspace.links,
    changed: edited.changed,
  }
}

/**
 * Follow Workspace-record deletions and take the directory apart, unless a live
 * Session is working inside it right now. An attached but idle Session keeps
 * the recorded cwd; losing a directory it is not using costs nothing, while a
 * directory left behind forever costs the operator the deletion they asked
 * for. Anything the plugin did not create keeps the directory alive either, so
 * it is adopted again if the same folders are picked later.
 * @param ctx - Host plugin context.
 * @param rootDir - combined-workspace root.
 */
function registerDirectoryCleanup(ctx: HostContext, rootDir: string): void {
  if (typeof ctx.on !== 'function') return
  const known = new Map<string, string>()
  const registry = registryOf(ctx)
  if (registry !== undefined && typeof registry.list === 'function') {
    try {
      for (const workspace of registry.list()) known.set(String(workspace.id), workspace.path)
    } catch {
      // A registry that cannot list simply starts with no history.
    }
  }
  ctx.on('domain/changed', change => {
    if (change.domain !== WORKSPACE_DOMAIN || change.table !== WORKSPACE_TABLE) return
    const key = typeof change.key === 'string' ? change.key : ''
    if (key === '') return
    if (change.operation === 'put') {
      const record = change.value as {
        path?: unknown
        sessionIds?: unknown
        title?: unknown
      } | null
      if (record === null || record === undefined || typeof record.path !== 'string') return
      known.set(key, record.path)
      // The shipped Rename dialog writes the registry, not our manifest; keep
      // the two in step so a later membership change cannot undo that rename.
      if (typeof record.title === 'string' && record.title !== '') {
        void syncWorkspaceTitle(record.path, record.title).catch(() => undefined)
      }
      return
    }
    if (change.operation !== 'deleted') return
    const path = known.get(key)
    known.delete(key)
    if (path === undefined) return
    // An idle session keeps working with a directory that no longer exists as
    // badly as a running one; only live work is worth keeping it for. A Session
    // may sit in the workspace directory itself or inside any member folder, so
    // both are checked.
    void (async () => {
      const workspace = await readCombinedWorkspaceWithin(path, rootDir)
      if (workspace === null) return
      const busy = await liveWorkingDirectories(ctx)
      const targets = [workspace.dir, ...workspace.links.map(link => link.target)]
      if (busy.some(cwd => targets.some(target => contains(target, cwd)))) return
      await dissolveWorkspaceDirectory(workspace.dir)
    })()
  })
}

/**
 * Build the service object and attach the visible Typert Remote binding.
 * @param ctx - Host plugin context (used lazily for `workspaceRegistry`).
 * @param rootDir - absolute root that holds real combined workspaces.
 * @returns the mounted-ready service.
 */
export function createMultiWorkspaceService(ctx: HostContext, rootDir: string): MultiWorkspaceService {
  const service = {
    async pick(message: string): Promise<string[] | null> {
      const connection = ctx.get('connection') as
        | { readonly allowsRemoteAuthorities?: boolean }
        | undefined
      const blocker = nativePanelBlocker({
        ...(connection?.allowsRemoteAuthorities === undefined
          ? {}
          : { allowsRemoteAuthorities: connection.allowsRemoteAuthorities }),
      })
      if (blocker !== null) {
        throw new RemoteFailure(
          'multi-workspace/pick-unavailable',
          `The native folder panel is unavailable on this host (${blocker}); use the in-app browser instead.`,
          { reason: blocker },
        )
      }
      try {
        return await pickNativeDirectories(message)
      } catch (error) {
        // A panel that exists but cannot run is still recoverable: let the
        // Client fall back to the browser dialog rather than dead-end.
        throw new RemoteFailure('multi-workspace/pick-unavailable', errorMessage(error), {
          reason: 'native-failed',
        })
      }
    },
    async list(path: string | null): Promise<DirectoryListing> {
      try {
        return await buildDirectoryListing(path ?? undefined)
      } catch (error) {
        if (error instanceof ListingError) {
          throw new RemoteFailure('multi-workspace/list-failed', error.message, {
            reason: error.code,
            path,
          })
        }
        throw new RemoteFailure('multi-workspace/list-failed', errorMessage(error), { path })
      }
    },
    async create(request: WorkspaceCreateRequest): Promise<WorkspaceCreateResult> {
      const parsed = createRequestSchema.safeParse(request)
      if (!parsed.success) {
        throw new RemoteFailure('multi-workspace/invalid-request', 'The folder selection is not valid.', {
          issues: parsed.error.issues.map(issue => issue.message),
        })
      }
      if (parsed.data.paths.length < 2) {
        throw new RemoteFailure(
          'multi-workspace/invalid-selection',
          'A combined workspace needs at least two folders; a single folder is opened directly.',
          { reason: 'too-few-paths' },
        )
      }
      const title = parsed.data.title
      const registry = registryOf(ctx)
      let materialized: MaterializedWorkspace
      try {
        materialized = await materializeWorkspace({
          rootDir,
          paths: parsed.data.paths,
          takenTitles: siblingOptions(ctx).takenTitles,
          ...(title === undefined ? {} : { title }),
        })
      } catch (error) {
        if (error instanceof SelectionError) {
          throw new RemoteFailure('multi-workspace/invalid-selection', error.message, {
            reason: error.code,
          })
        }
        throw new RemoteFailure('multi-workspace/create-failed', errorMessage(error))
      }

      if (registry === undefined) {
        if (!materialized.adopted) await dissolveWorkspaceDirectory(materialized.dir)
        throw new RemoteFailure(
          'multi-workspace/unavailable',
          'The workspace registry is unavailable in this Host composition.',
        )
      }

      let workspace: WorkspaceEntityLike
      try {
        workspace = await registry.create(materialized.dir, materialized.title)
      } catch (error) {
        // The registry rejected the registration; do not leave a directory we
        // created behind. An adopted directory is somebody else's: keep it.
        if (!materialized.adopted) await dissolveWorkspaceDirectory(materialized.dir)
        throw new RemoteFailure('multi-workspace/register-failed', errorMessage(error))
      }

      return {
        path: workspace.path,
        title: workspace.title,
        titleAuto: materialized.titleAuto,
        workspaceId: String(workspace.id),
        created: !materialized.adopted,
        links: materialized.links,
        sources: materialized.sources,
      }
    },
    async inspect(request: WorkspaceInspectRequest): Promise<WorkspaceInfo | null> {
      const parsed = inspectRequestSchema.safeParse(request)
      if (!parsed.success) {
        throw new RemoteFailure('multi-workspace/invalid-request', 'The workspace path is not valid.', {
          issues: parsed.error.issues.map(issue => issue.message),
        })
      }
      const workspace = await readCombinedWorkspaceWithin(parsed.data.path, rootDir)
      if (workspace === null) return null
      const owner = await ownedWorkspace(registryOf(ctx), workspace.dir)
      const busy = await liveWorkingDirectories(ctx)
      return {
        path: workspace.dir,
        title: workspace.title,
        titleAuto: workspace.titleAuto,
        members: workspace.links.map(link => ({
          ...link,
          ...(busy.some(cwd => contains(link.target, cwd)) ? { inUse: true } : {}),
        })),
        ...(owner === undefined ? {} : { workspaceId: String(owner.id) }),
      }
    },
    async addFolders(request: WorkspaceAddRequest): Promise<WorkspaceUpdateResult> {
      const parsed = addRequestSchema.safeParse(request)
      if (!parsed.success) {
        throw new RemoteFailure('multi-workspace/invalid-request', 'The folder selection is not valid.', {
          issues: parsed.error.issues.map(issue => issue.message),
        })
      }
      return await applyEdit(ctx, rootDir, () =>
        addFolders(parsed.data.path, parsed.data.paths, { rootDir, ...siblingOptions(ctx) }),
      )
    },
    async removeFolders(request: WorkspaceRemoveRequest): Promise<WorkspaceUpdateResult> {
      const parsed = removeRequestSchema.safeParse(request)
      if (!parsed.success) {
        throw new RemoteFailure('multi-workspace/invalid-request', 'The member selection is not valid.', {
          issues: parsed.error.issues.map(issue => issue.message),
        })
      }
      return await applyEdit(ctx, rootDir, () =>
        removeFolders(parsed.data.path, parsed.data.names, { rootDir, ...siblingOptions(ctx) }),
      )
    },
    typertRemote: undefined as unknown as MultiWorkspaceService['typertRemote'],
  } as MultiWorkspaceService

  Object.defineProperty(service, 'typertRemote', {
    value: Object.freeze({ service, serviceKey: NAMESPACE, namespace: NAMESPACE }),
    enumerable: true,
    configurable: false,
    writable: false,
  })
  return service
}

/**
 * Cordis plugin entry.
 * @param context - the owning plugin context.
 * @param config - optional row configuration.
 */
export function apply(context: unknown, config?: MultiWorkspaceConfig): void {
  const ctx = context as HostContext
  const rootDir = resolveWorkspaceRoot(config?.rootDir)
  const service = createMultiWorkspaceService(ctx, rootDir)
  ctx.provide(NAMESPACE, service)
  registerDirectoryCleanup(ctx, rootDir)

  // Tell the model how the built-in worktree, search, and sandbox behavior
  // differs inside a combined workspace. The provider only contributes text for
  // sessions whose effective directory is inside rootDir.
  registerCombinedWorkspaceGuidance(
    {
      inject: (dependencies, callback) =>
        ctx.inject(dependencies, scope => {
          callback(scope as { systemPrompt: SystemPromptLike })
        }),
    },
    {
      rootDir,
      resolveCwd: session => {
        if (session === undefined) return undefined
        const workingDirectory = ctx.get('workingDirectory') as WorkingDirectoryLike | undefined
        const effective =
          workingDirectory !== undefined && typeof workingDirectory.get === 'function'
            ? workingDirectory.get(session)
            : undefined
        const header = (session as { header?: { cwd?: string } }).header
        return typeof effective === 'string' && effective !== '' ? effective : header?.cwd
      },
    },
  )
}
