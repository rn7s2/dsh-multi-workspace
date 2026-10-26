/**
 * Host half of the multi-workspace plugin.
 *
 * Mounted as a dependency-free plain ESM Cordis plugin: it registers one
 * `multiWorkspace` service through `ctx.provide()` and publishes a Typert
 * Remote manifest from `./typert`. The Client flow calls `multiWorkspace/pick`
 * for the native macOS multi-folder panel and `multiWorkspace/create` for the
 * combined workspace; this half materializes the real combined directory,
 * symlinks the picked folders into it, and registers the durable Workspace
 * through `ctx.workspaceRegistry`.
 *
 * @module dsh-multi-workspace/host
 */
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { SelectionError } from './core.js'
import { materializeWorkspace, removeWorkspaceDirectory } from './fs.js'
import type { MaterializedWorkspace } from './fs.js'
import { pickNativeDirectories } from './native-picker.js'
import { registerCombinedWorkspaceGuidance, type SystemPromptLike } from './prompt.js'
import {
  NAMESPACE,
  createRequestSchema,
  type WorkspaceCreateRequest,
  type WorkspaceCreateResult,
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
}

/** The Workspace registry service surface this plugin relies on. */
interface WorkspaceRegistryLike {
  create(path: string, title?: string): Promise<WorkspaceEntityLike>
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
   */
  pick(message: string): Promise<string[] | null>
  /**
   * Create a combined workspace from two or more folders.
   * @param request - folder paths and an optional title override.
   * @returns the materialized directory and its durable registration.
   */
  create(request: WorkspaceCreateRequest): Promise<WorkspaceCreateResult>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
      try {
        return await pickNativeDirectories(message)
      } catch (error) {
        throw new RemoteFailure('multi-workspace/pick-failed', errorMessage(error))
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
      let materialized: MaterializedWorkspace
      try {
        materialized = await materializeWorkspace({
          rootDir,
          paths: parsed.data.paths,
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

      const registry = ctx.get('workspaceRegistry') as WorkspaceRegistryLike | undefined
      if (registry === undefined || typeof registry.create !== 'function') {
        await removeWorkspaceDirectory(materialized.dir)
        throw new RemoteFailure(
          'multi-workspace/unavailable',
          'The workspace registry is unavailable in this Host composition.',
        )
      }

      let workspace: WorkspaceEntityLike
      try {
        workspace = await registry.create(materialized.dir, materialized.title)
      } catch (error) {
        // The registry rejected the registration; do not leave an unreferenced
        // directory behind.
        await removeWorkspaceDirectory(materialized.dir)
        throw new RemoteFailure('multi-workspace/register-failed', errorMessage(error))
      }

      return {
        path: workspace.path,
        title: workspace.title,
        workspaceId: String(workspace.id),
        created: true,
        links: materialized.links,
        sources: materialized.sources,
      }
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
