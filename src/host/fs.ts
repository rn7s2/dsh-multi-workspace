/**
 * Filesystem side of a combined workspace: validate the selected directories,
 * materialize one real directory of symlinks, and edit that directory's member
 * set in place. The directory is named after a time-ordered UUID, so its
 * identity never depends on the folders it happens to hold and adding or
 * removing folders never renames the path a Session already recorded.
 *
 * @module dsh-multi-workspace/host/fs
 */
import { lstat, mkdir, readdir, readFile, realpath, rename, rm, stat, symlink, unlink, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, resolve, sep } from 'node:path'
import { HARD_MAX_PATHS, deriveTitleFromPaths, isDerivedTitle, uniqueTitle } from '../shared/naming.js'
import { MANIFEST_FILE, MIN_MEMBERS, type WorkspaceLink } from '../shared/rpc.js'
import { uuidv7 } from '../shared/uuid.js'
import { SelectionError, buildPlan, planAddition, planRemoval } from './core.js'
import type { SelectionPlan } from './core.js'

/** How many times a manifest write is retried after a rename race. */
const MAX_MANIFEST_ATTEMPTS = 3

/** Manifest versions this build understands; 1 predates the UUID identity. */
const VERSIONS = [1, 2] as const

/** Metadata written into every combined workspace directory. */
export interface WorkspaceManifest {
  /** Manifest schema version. */
  version: typeof VERSIONS[number]
  /** Discriminator so a stray file can be recognized. */
  kind: 'dsh-multi-workspace'
  /** Durable identity: the directory's own name when the workspace was created by this build. */
  id: string
  /** Creation time in ISO 8601. */
  createdAt: string
  /** Durable Workspace title. */
  title: string
  /** Whether {@link WorkspaceManifest.title} is derived from the folders and may be recomputed. */
  titleAuto: boolean
  /** Symlinks created in the directory, in member order. */
  links: WorkspaceLink[]
}

/** One combined workspace as read back from disk. */
export interface CombinedWorkspace {
  /** Absolute directory. */
  dir: string
  /** Durable identity (directory name for workspaces this build created). */
  id: string
  /** Durable Workspace title. */
  title: string
  /** Whether the title is derived from the folders. */
  titleAuto: boolean
  /** Creation stamp recorded in the manifest, or an empty string for a manifest without one. */
  createdAt: string
  /** Member links in member order. */
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
  /** Durable identity. */
  id: string
  /** Durable Workspace title. */
  title: string
  /** Whether the title is derived from the folders. */
  titleAuto: boolean
  /** Canonical source directories in selection order. */
  sources: string[]
  /** Symlinks inside {@link dir}, in member order. */
  links: WorkspaceLink[]
  /** True when an existing unowned directory was adopted instead of created. */
  adopted: boolean
}

/** Inputs of {@link addFolders} and {@link removeFolders}. */
export interface EditOptions {
  /** Directory that holds every combined workspace; the edited directory must be inside it. */
  rootDir: string
  /** Titles of every other registered Workspace, used when the title is recomputed. */
  takenTitles?: readonly string[]
  /** Lowest member count an edit may leave behind; defaults to 2. */
  minMembers?: number
}

/** Result of an edit. */
export interface EditedWorkspace {
  /** The workspace after the edit. */
  workspace: CombinedWorkspace
  /** Links added or removed by the edit. */
  changed: WorkspaceLink[]
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
  const minPaths = options.minPaths ?? MIN_MEMBERS
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
    const canonical = await canonicalSource(rawPath, rootDir, rawSeen, canonicalSeen)
    sources.push(canonical)
  }

  return sources
}

/**
 * Canonicalize one selected directory and record it in the duplicate sets.
 * @param rawPath - path as chosen by the operator.
 * @param rootDir - canonical workspace root.
 * @param rawSeen - raw spellings already accepted.
 * @param canonicalSeen - resolved paths already accepted.
 * @returns the resolved directory.
 * @throws {SelectionError} when the path is unusable or repeated.
 */
async function canonicalSource(
  rawPath: string,
  rootDir: string,
  rawSeen: Set<string>,
  canonicalSeen: Set<string>,
): Promise<string> {
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
  return canonical
}

/**
 * Create a combined workspace directory, its symlinks, and its manifest.
 *
 * When an unregistered directory under the root already holds exactly these
 * folders, that directory is reused (and repaired) instead of allocating a
 * second identity for the same set.
 *
 * @param options - root, selected paths, and optional title/minimum.
 * @returns the directory, title, canonical sources, links, and adoption flag.
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

  const reusable = await findReusableDirectory(rootDir, sources)
  if (reusable !== undefined) {
    const adopted = await adoptDirectory(reusable, plan)
    return {
      dir: adopted.dir,
      id: adopted.id,
      title: adopted.title,
      titleAuto: adopted.titleAuto,
      sources,
      links: adopted.links,
      adopted: true,
    }
  }

  const dir = await createWorkspaceDirectory(rootDir, plan)
  return {
    dir,
    id: basename(dir),
    title: plan.title,
    titleAuto: plan.titleAuto,
    sources,
    links: plan.links,
    adopted: false,
  }
}

/**
 * Append folders to an existing combined workspace.
 * @param dir - absolute combined-workspace directory inside {@link EditOptions.rootDir}.
 * @param paths - absolute directories to link in.
 * @param options - workspace root, sibling titles, and member floor.
 * @returns the updated workspace and the links that were added.
 * @throws {SelectionError} for an unknown directory, a duplicate member, or a failed write.
 */
export async function addFolders(
  dir: string,
  paths: readonly string[],
  options: EditOptions,
): Promise<EditedWorkspace> {
  const workspace = await requireCombinedWorkspace(dir, options.rootDir)
  if (paths.length === 0) {
    throw new SelectionError('empty-selection', 'No folders were selected; choose at least one folder.')
  }
  if (workspace.links.length + paths.length > HARD_MAX_PATHS) {
    throw new SelectionError(
      'too-many-paths',
      `A combined workspace holds at most ${HARD_MAX_PATHS} folders; this one would hold ${workspace.links.length + paths.length}.`,
    )
  }

  const rawSeen = new Set<string>()
  const canonicalSeen = new Set(workspace.links.map(link => link.target))
  const rootDir = await canonicalRoot(options.rootDir)
  const sources: string[] = []
  for (const rawPath of paths) {
    if (canonicalSeen.has(rawPath)) {
      throw new SelectionError('duplicate-path', `Folder is already part of this workspace: "${rawPath}".`)
    }
    const canonical = await canonicalSource(rawPath, rootDir, rawSeen, canonicalSeen)
    sources.push(canonical)
  }

  const added = planAddition(workspace.links, sources)
  const created: WorkspaceLink[] = []
  try {
    for (const link of added) {
      await symlink(link.target, join(workspace.dir, link.name), 'dir')
      created.push(link)
    }
  } catch (cause) {
    await unlinkQuietly(workspace.dir, created)
    throw new SelectionError(
      'materialize-failed',
      `Could not add the folders to "${workspace.dir}": ${messageOf(cause)}`,
      { cause },
    )
  }

  const links = [...workspace.links, ...added]
  try {
    return { workspace: await commitManifest(workspace, links, options), changed: added }
  } catch (error) {
    await unlinkQuietly(workspace.dir, created)
    throw error
  }
}

/**
 * Remove folders from an existing combined workspace. The target directories
 * are never touched: only the symlinks and the manifest entry are dropped.
 * @param dir - absolute combined-workspace directory inside {@link EditOptions.rootDir}.
 * @param names - entry names to drop.
 * @param options - workspace root, sibling titles, and member floor.
 * @returns the updated workspace and the links that were removed.
 * @throws {SelectionError} for an unknown member, a short remainder, or a failed write.
 */
export async function removeFolders(
  dir: string,
  names: readonly string[],
  options: EditOptions,
): Promise<EditedWorkspace> {
  const workspace = await requireCombinedWorkspace(dir, options.rootDir)
  const { remaining, removed } = planRemoval(workspace.links, names, options.minMembers ?? MIN_MEMBERS)

  const unlinked: WorkspaceLink[] = []
  try {
    for (const link of removed) {
      const entryPath = join(workspace.dir, link.name)
      const info = await lstat(entryPath)
      if (!info.isSymbolicLink()) {
        throw new SelectionError(
          'materialize-failed',
          `"${link.name}" is not a link created by this plugin; remove it from the directory by hand.`,
        )
      }
      await unlink(entryPath)
      unlinked.push(link)
    }
  } catch (cause) {
    await restoreLinks(workspace.dir, unlinked)
    if (cause instanceof SelectionError) throw cause
    throw new SelectionError(
      'materialize-failed',
      `Could not remove the folders from "${workspace.dir}": ${messageOf(cause)}`,
      { cause },
    )
  }

  try {
    return { workspace: await commitManifest(workspace, remaining, options), changed: removed }
  } catch (error) {
    await restoreLinks(workspace.dir, unlinked)
    throw error
  }
}

/**
 * Read a combined workspace directory, tolerating the pre-UUID manifest shape.
 * @param dir - absolute directory.
 * @returns the workspace, or null when the directory holds no valid manifest.
 */
export async function readCombinedWorkspace(dir: string): Promise<CombinedWorkspace | null> {
  let raw: string
  try {
    raw = await readFile(join(dir, MANIFEST_FILE), 'utf8')
  } catch {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Record<string, unknown>
  if (record['kind'] !== 'dsh-multi-workspace') return null
  const links = parseLinks(record['links'])
  if (links === null || links.length === 0) return null
  const title = typeof record['title'] === 'string' && record['title'] !== '' ? record['title'] : ''
  if (title === '') return null
  const id = typeof record['id'] === 'string' && record['id'] !== '' ? record['id'] : basename(resolve(dir))
  const titleAuto =
    typeof record['titleAuto'] === 'boolean'
      ? record['titleAuto']
      : isDerivedTitle(title, links.map(link => link.target))
  const createdAt = typeof record['createdAt'] === 'string' ? record['createdAt'] : ''
  return {
    dir: resolve(dir),
    id,
    title,
    titleAuto,
    createdAt,
    links,
  }
}

/**
 * Delete a combined workspace directory. Symlinked members are unlinked, never
 * traversed, so no member content is ever removed.
 * @param dir - absolute workspace directory.
 */
export async function removeWorkspaceDirectory(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
}

/**
 * Recompute the durable title after a membership change.
 * @param workspace - workspace before the change.
 * @param links - members after the change.
 * @param options - sibling titles and the workspace root.
 * @returns the title and whether it is automatic.
 */
async function nextTitle(
  workspace: CombinedWorkspace,
  links: readonly WorkspaceLink[],
  options: EditOptions,
): Promise<{ title: string; titleAuto: boolean }> {
  if (!workspace.titleAuto) return { title: workspace.title, titleAuto: false }
  const desired = deriveTitleFromPaths(links.map(link => link.target))
  const taken = (options.takenTitles ?? []).filter(title => title !== workspace.title)
  return { title: uniqueTitle(desired, taken), titleAuto: true }
}

/**
 * Write the manifest for an edited workspace and read it back.
 * @param workspace - workspace before the change.
 * @param links - members after the change.
 * @param options - sibling titles and the workspace root.
 * @returns the workspace projection after the change.
 */
async function commitManifest(
  workspace: CombinedWorkspace,
  links: readonly WorkspaceLink[],
  options: EditOptions,
): Promise<CombinedWorkspace> {
  const { title, titleAuto } = await nextTitle(workspace, links, options)
  const manifest: WorkspaceManifest = {
    version: 2,
    kind: 'dsh-multi-workspace',
    id: workspace.id,
    createdAt: workspace.createdAt === '' ? new Date().toISOString() : workspace.createdAt,
    title,
    titleAuto,
    links: links.map(link => ({ name: link.name, target: link.target })),
  }
  await writeManifest(workspace.dir, manifest)
  return {
    dir: workspace.dir,
    id: workspace.id,
    title,
    titleAuto,
    createdAt: workspace.createdAt,
    links: [...links],
  }
}

/**
 * Read and validate the manifest of an editable directory.
 * @param dir - directory named by the caller.
 * @param rootDir - configured workspace root.
 * @returns the workspace projection.
 * @throws {SelectionError} `not-combined` when the directory is foreign or holds no manifest.
 */
async function requireCombinedWorkspace(dir: string, rootDir: string): Promise<CombinedWorkspace> {
  const absolute = resolve(dir)
  const root = await canonicalRoot(rootDir)
  const real = await realpath(absolute).catch(() => absolute)
  if (!isInsideRoot(real, root)) {
    throw new SelectionError(
      'not-combined',
      `"${absolute}" is not inside the combined-workspace root "${root}".`,
    )
  }
  const workspace = await readCombinedWorkspace(real)
  if (workspace === null) {
    throw new SelectionError('not-combined', `"${absolute}" is not a combined workspace.`)
  }
  return workspace
}

/**
 * Find a directory under the root holding exactly these members. A registered
 * directory is reused too: picking the same folders again resolves onto the
 * existing workspace instead of doubling it under a new identity.
 * @param rootDir - existing workspace root.
 * @param sources - canonical directories to match.
 * @returns the reusable directory, or undefined.
 */
async function findReusableDirectory(
  rootDir: string,
  sources: readonly string[],
): Promise<string | undefined> {
  let names: string[]
  try {
    names = await readdir(rootDir)
  } catch {
    return undefined
  }
  const wanted = [...sources].sort()
  for (const name of names.sort()) {
    const candidate = join(rootDir, name)
    const workspace = await readCombinedWorkspace(candidate)
    if (workspace === null) continue
    const members = workspace.links.map(link => link.target).sort()
    if (members.length !== wanted.length) continue
    if (members.some((member, index) => member !== wanted[index])) continue
    return candidate
  }
  return undefined
}

/**
 * Take over an existing directory: repair missing links, adopt the plan's
 * title when the manifest has none, and rewrite the manifest.
 * @param dir - reusable directory.
 * @param plan - plan describing the same member set.
 * @returns the adopted workspace.
 */
async function adoptDirectory(dir: string, plan: SelectionPlan): Promise<CombinedWorkspace> {
  const existing = await readCombinedWorkspace(dir)
  const links = existing?.links ?? plan.links
  for (const link of links) {
    try {
      await lstat(join(dir, link.name))
    } catch {
      await symlink(link.target, join(dir, link.name), 'dir')
    }
  }
  const title = existing?.title ?? plan.title
  const titleAuto = existing?.titleAuto ?? plan.titleAuto
  const manifest: WorkspaceManifest = {
    version: 2,
    kind: 'dsh-multi-workspace',
    id: existing?.id ?? basename(dir),
    createdAt: existing?.createdAt !== undefined && existing.createdAt !== ''
      ? existing.createdAt
      : new Date().toISOString(),
    title,
    titleAuto,
    links,
  }
  await writeManifest(dir, manifest)
  return { dir: resolve(dir), id: manifest.id, title, titleAuto, createdAt: manifest.createdAt, links }
}

/**
 * Create the UUID-named directory, add every symlink, and write the manifest.
 * Removes the directory again if any of those steps fail.
 * @param rootDir - existing workspace root.
 * @param plan - validated plan.
 * @returns the absolute path of the new directory.
 */
async function createWorkspaceDirectory(rootDir: string, plan: SelectionPlan): Promise<string> {
  const dir = join(rootDir, uuidv7())
  try {
    await mkdir(dir)
    for (const link of plan.links) {
      await symlink(link.target, join(dir, link.name), 'dir')
    }
    const manifest: WorkspaceManifest = {
      version: 2,
      kind: 'dsh-multi-workspace',
      id: basename(dir),
      createdAt: new Date().toISOString(),
      title: plan.title,
      titleAuto: plan.titleAuto,
      links: plan.links.map(link => ({ name: link.name, target: link.target })),
    }
    await writeManifest(dir, manifest)
    return dir
  } catch (cause) {
    try {
      await rm(dir, { recursive: true, force: true })
    } catch {
      // Best effort: the original failure is the one worth reporting.
    }
    throw new SelectionError(
      'materialize-failed',
      `Could not materialize the combined workspace in "${rootDir}": ${messageOf(cause)}`,
      { cause },
    )
  }
}

/**
 * Write the manifest through a temporary file so a crash cannot leave a
 * half-written record.
 * @param dir - combined workspace directory.
 * @param manifest - complete manifest.
 */
async function writeManifest(dir: string, manifest: WorkspaceManifest): Promise<void> {
  const target = join(dir, MANIFEST_FILE)
  const body = `${JSON.stringify(manifest, null, 2)}\n`
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_MANIFEST_ATTEMPTS; attempt += 1) {
    const temporary = join(dir, `${MANIFEST_FILE}.${process.pid}.${attempt}.tmp`)
    try {
      await writeFile(temporary, body, 'utf8')
      await rename(temporary, target)
      return
    } catch (cause) {
      lastError = cause
      await unlink(temporary).catch(() => undefined)
    }
  }
  throw new SelectionError(
    'materialize-failed',
    `Could not write the workspace manifest in "${dir}": ${messageOf(lastError)}`,
    { cause: lastError },
  )
}

/**
 * Parse the `links` array of a manifest.
 * @param value - unknown manifest field.
 * @returns the links, or null when malformed.
 */
function parseLinks(value: unknown): WorkspaceLink[] | null {
  if (!Array.isArray(value)) return null
  const links: WorkspaceLink[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) return null
    const name = (entry as { name?: unknown }).name
    const target = (entry as { target?: unknown }).target
    if (typeof name !== 'string' || name === '') return null
    if (typeof target !== 'string' || target === '') return null
    links.push({ name, target })
  }
  return links
}

/**
 * Unlink the links at the given names, ignoring entries that are already gone.
 * @param dir - combined workspace directory.
 * @param links - links to drop.
 */
async function unlinkQuietly(dir: string, links: readonly WorkspaceLink[]): Promise<void> {
  for (const link of links) {
    await unlink(join(dir, link.name)).catch(() => undefined)
  }
}

/**
 * Recreate symlinks that a failed removal already unlinked.
 * @param dir - combined workspace directory.
 * @param links - links to restore.
 */
async function restoreLinks(dir: string, links: readonly WorkspaceLink[]): Promise<void> {
  for (const link of links) {
    await symlink(link.target, join(dir, link.name), 'dir').catch(() => undefined)
  }
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

/**
 * Bring a manifest title back in step with the durable Workspace title after a
 * rename made elsewhere (the shipped Rename dialog writes the registry only).
 * A title that no longer matches its folders is recorded as manual, so a later
 * membership change cannot overwrite the operator's choice.
 * @param dir - combined workspace directory.
 * @param title - durable Workspace title.
 * @returns true when the manifest changed.
 */
export async function syncWorkspaceTitle(dir: string, title: string): Promise<boolean> {
  const workspace = await readCombinedWorkspace(dir)
  if (workspace === null || workspace.title === title) return false
  const titleAuto = isDerivedTitle(title, workspace.links.map(link => link.target))
  await writeManifest(dir, {
    version: 2,
    kind: 'dsh-multi-workspace',
    id: workspace.id,
    createdAt: workspace.createdAt === '' ? new Date().toISOString() : workspace.createdAt,
    title,
    titleAuto,
    links: workspace.links,
  })
  return true
}
