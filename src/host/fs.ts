/**
 * Filesystem side of combined-workspace creation: validate the selected
 * directories, materialize a real directory full of symlinks, write the hidden
 * manifest, and clean up after itself on failure.
 *
 * @module dsh-multi-workspace/host/fs
 */
import { accessSync } from 'node:fs'
import { mkdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve, sep } from 'node:path'
import { HARD_MAX_PATHS } from '../shared/naming.js'
import { MANIFEST_FILE } from '../shared/rpc.js'
import type { WorkspaceLink } from '../shared/rpc.js'
import { SelectionError, buildPlan, uniqueDirectoryName } from './core.js'
import type { SelectionPlan } from './core.js'

/** Default minimum number of folders in a combined workspace. */
const MIN_PATHS = 2

/** How many times `mkdir` is retried after an `EEXIST` race. */
const MAX_DIRECTORY_ATTEMPTS = 10

/** Metadata written into every combined workspace directory. */
interface WorkspaceManifest {
  /** Manifest schema version. */
  version: 1
  /** Discriminator so a stray file can be recognized. */
  kind: 'dsh-multi-workspace'
  /** Creation time in ISO 8601. */
  createdAt: string
  /** Durable Workspace title. */
  title: string
  /** Symlinks created in the directory, in selection order. */
  links: WorkspaceLink[]
}

/** Inputs of {@link materializeWorkspace}. */
export interface MaterializeOptions {
  /** Directory that holds every combined workspace (created when missing). */
  rootDir: string
  /** Absolute source directories in selection order. */
  paths: readonly string[]
  /** Optional explicit Workspace title. */
  title?: string
  /** Minimum number of folders required; defaults to 2. */
  minPaths?: number
}

/** Result of a successful materialization. */
export interface MaterializedWorkspace {
  /** Absolute path of the real combined workspace directory. */
  dir: string
  /** Durable Workspace title. */
  title: string
  /** Canonical source directories in selection order. */
  sources: string[]
  /** Symlinks created inside {@link dir}. */
  links: WorkspaceLink[]
}

/**
 * Validate and canonicalize the selected source directories.
 *
 * Paths are checked in selection order: absolute, present, a directory, then
 * resolved with `realpath` (so symlinked spellings collapse onto one source).
 * The first violation wins, which makes the reported code predictable.
 *
 * @param paths - directories chosen by the operator.
 * @param options - workspace root (for the containment check) and minimum count.
 * @returns canonical absolute directories in selection order.
 * @throws {SelectionError} with a code from {@link SelectionErrorCode}.
 */
export async function resolveSources(
  paths: readonly string[],
  options: { rootDir: string; minPaths?: number },
): Promise<string[]> {
  const minPaths = options.minPaths ?? MIN_PATHS
  if (paths.length === 0) {
    throw new SelectionError('empty-selection', 'No folders were selected; choose at least one folder.')
  }
  if (paths.length > HARD_MAX_PATHS) {
    throw new SelectionError(
      'too-many-paths',
      `At most ${HARD_MAX_PATHS} folders can be combined; ${paths.length} were selected.`,
    )
  }
  if (paths.length < minPaths) {
    throw new SelectionError(
      'too-few-paths',
      `A combined workspace needs at least ${minPaths} folders; ${paths.length} were selected.`,
    )
  }

  const rootDir = await canonicalRoot(options.rootDir)
  const rawSeen = new Set<string>()
  const canonicalSeen = new Set<string>()
  const sources: string[] = []

  for (const rawPath of paths) {
    if (!isAbsolute(rawPath)) {
      throw new SelectionError(
        'path-not-absolute',
        `Folder path must be absolute: "${rawPath}". Choose the folder through the directory picker.`,
      )
    }
    if (rawSeen.has(rawPath)) {
      throw new SelectionError('duplicate-path', `Folder was selected more than once: "${rawPath}".`)
    }
    rawSeen.add(rawPath)

    let info: Awaited<ReturnType<typeof stat>>
    try {
      info = await stat(rawPath)
    } catch (cause) {
      if (isErrorCode(cause, 'ENOTDIR')) {
        throw new SelectionError('path-not-directory', `Not a directory: "${rawPath}".`, { cause })
      }
      throw new SelectionError(
        'path-missing',
        `Folder does not exist or is not accessible: "${rawPath}".`,
        { cause },
      )
    }
    if (!info.isDirectory()) {
      throw new SelectionError('path-not-directory', `Not a directory: "${rawPath}".`)
    }

    let canonical: string
    try {
      canonical = await realpath(rawPath)
    } catch (cause) {
      throw new SelectionError('path-missing', `Could not resolve folder path: "${rawPath}".`, { cause })
    }
    if (canonicalSeen.has(canonical)) {
      throw new SelectionError(
        'duplicate-path',
        `Folder "${rawPath}" resolves to "${canonical}", which is already selected.`,
      )
    }
    canonicalSeen.add(canonical)

    if (isInsideRoot(canonical, rootDir)) {
      throw new SelectionError(
        'inside-workspace-root',
        `Folder "${rawPath}" is inside the combined-workspace root "${rootDir}"; choose a folder outside it.`,
      )
    }
    sources.push(canonical)
  }

  return sources
}

/**
 * Create a combined workspace directory, its symlinks, and its manifest.
 *
 * On any failure after the directory has been created the partially built
 * directory is removed before the rejection leaves this function.
 *
 * @param options - root, selected paths, and optional title/minimum.
 * @returns the created directory, title, canonical sources, and links.
 * @throws {SelectionError} `root-unavailable`, `materialize-failed`, or a
 * validation code from {@link resolveSources}.
 */
export async function materializeWorkspace(options: MaterializeOptions): Promise<MaterializedWorkspace> {
  const rootDir = resolve(options.rootDir)
  const sources = await resolveSources(options.paths, {
    rootDir,
    ...(options.minPaths === undefined ? {} : { minPaths: options.minPaths }),
  })
  const plan = options.title === undefined ? buildPlan(sources) : buildPlan(sources, { title: options.title })

  try {
    await mkdir(rootDir, { recursive: true })
  } catch (cause) {
    throw new SelectionError(
      'root-unavailable',
      `Could not create the combined-workspace root "${rootDir}": ${messageOf(cause)}`,
      { cause },
    )
  }

  const dir = await createWorkspaceDirectory(rootDir, plan)
  return { dir, title: plan.title, sources, links: plan.links }
}

/**
 * Delete a combined workspace directory and everything below it.
 * Symlinked sources are unlinked, never traversed.
 * @param dir - absolute workspace directory.
 */
export async function removeWorkspaceDirectory(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
}

/**
 * Create the uniquely named directory, add every symlink, and write the
 * manifest. Removes the directory again if any of those steps fail.
 * @param rootDir - existing workspace root.
 * @param plan - validated plan.
 * @returns the absolute path of the new directory.
 */
async function createWorkspaceDirectory(rootDir: string, plan: SelectionPlan): Promise<string> {
  let dir: string | undefined
  try {
    dir = await allocateWorkspaceDirectory(rootDir, plan.slug)
    for (const link of plan.links) {
      await symlink(link.target, join(dir, link.name), 'dir')
    }
    const manifest: WorkspaceManifest = {
      version: 1,
      kind: 'dsh-multi-workspace',
      createdAt: new Date().toISOString(),
      title: plan.title,
      links: plan.links.map(link => ({ name: link.name, target: link.target })),
    }
    await writeFile(join(dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    return dir
  } catch (cause) {
    if (dir !== undefined) {
      try {
        await rm(dir, { recursive: true, force: true })
      } catch {
        // Best effort: the original failure is the one worth reporting.
      }
    }
    throw new SelectionError(
      'materialize-failed',
      `Could not materialize the combined workspace in "${rootDir}": ${messageOf(cause)}`,
      { cause },
    )
  }
}

/**
 * Pick a free directory name and create it without recursion, retrying on an
 * `EEXIST` race for at most {@link MAX_DIRECTORY_ATTEMPTS} attempts.
 * @param rootDir - existing workspace root.
 * @param slug - slugified title.
 * @returns the absolute path of the created directory.
 */
async function allocateWorkspaceDirectory(rootDir: string, slug: string): Promise<string> {
  const unavailable = new Set<string>()
  for (let attempt = 0; attempt < MAX_DIRECTORY_ATTEMPTS; attempt += 1) {
    const name = uniqueDirectoryName(
      slug,
      candidate => unavailable.has(candidate) || entryExists(join(rootDir, candidate)),
    )
    const dir = join(rootDir, name)
    try {
      await mkdir(dir)
      return dir
    } catch (cause) {
      if (isErrorCode(cause, 'EEXIST')) {
        // A dangling symlink is invisible to access() yet still makes mkdir
        // fail; remember the name so the next attempt picks another candidate.
        unavailable.add(name)
        continue
      }
      throw cause
    }
  }
  throw new Error(
    `Could not allocate a unique directory for "${slug}" after ${MAX_DIRECTORY_ATTEMPTS} attempts.`,
  )
}

/**
 * Canonical absolute form of the workspace root. When the root does not exist
 * yet (or cannot be resolved) its normalized absolute path is used instead.
 * @param rootDir - configured workspace root.
 * @returns real path when possible, otherwise an absolute path.
 */
async function canonicalRoot(rootDir: string): Promise<string> {
  const absolute = resolve(rootDir)
  try {
    return await realpath(absolute)
  } catch {
    return absolute
  }
}

/**
 * True when `candidate` is `root` itself or a descendant of it.
 * @param candidate - canonical candidate path.
 * @param root - canonical root path.
 */
function isInsideRoot(candidate: string, root: string): boolean {
  if (candidate === root) return true
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`
  return candidate.startsWith(prefix)
}

/**
 * Probe whether a path exists without following a final symlink into a file
 * check; existence is all the uniqueness loop needs.
 * @param candidate - absolute candidate path.
 */
function entryExists(candidate: string): boolean {
  try {
    accessSync(candidate)
    return true
  } catch {
    return false
  }
}

/**
 * Read an errno-style `code` off an unknown rejection value.
 * @param error - rejection value.
 * @param code - errno code to compare against.
 */
function isErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  )
}

/**
 * Human-readable message for an unknown rejection value.
 * @param error - rejection value.
 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
