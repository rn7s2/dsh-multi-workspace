/**
 * Pure planning rules and the error taxonomy used while creating or editing a
 * combined workspace. Everything here is filesystem-free so the same rules can
 * be unit tested without a temporary directory; the filesystem side lives in
 * `./fs.ts`.
 *
 * @module dsh-multi-workspace/host/core
 */
import { MANIFEST_FILE, type WorkspaceLink } from '../shared/rpc.js'
import { assignLinkNames, basenameOf, deriveTitleFromPaths } from '../shared/naming.js'

/** Stable reason a selection or a materialization attempt was rejected. */
export type SelectionErrorCode =
  | 'empty-selection'
  | 'too-few-paths'
  | 'too-many-paths'
  | 'path-not-absolute'
  | 'path-missing'
  | 'path-not-directory'
  | 'duplicate-path'
  | 'inside-workspace-root'
  | 'root-unavailable'
  | 'materialize-failed'
  | 'not-combined'
  | 'member-unknown'
  | 'too-few-members'
  | 'last-member'

/**
 * Rejection raised by the Host selection and materialization pipeline.
 * Transport layers can branch on {@link SelectionError.code} without parsing
 * the human-readable message.
 */
export class SelectionError extends Error {
  /** Stable machine-readable reason. */
  readonly code: SelectionErrorCode

  constructor(code: SelectionErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'SelectionError'
    this.code = code
  }
}

/** Everything needed to create one combined workspace directory. */
export interface SelectionPlan {
  /** Durable Workspace title: explicit override or the derived "A, B and C" name. */
  title: string
  /** Whether {@link SelectionPlan.title} is derived from the folders (and so may be recomputed). */
  titleAuto: boolean
  /** Source directories in selection order (canonicalized by the caller). */
  sources: string[]
  /** Symlink entries to create, in the same order as {@link sources}. */
  links: WorkspaceLink[]
}

/**
 * Build the immutable description of a combined workspace.
 * @param sources - absolute source directories in selection order.
 * @param options - optional explicit title; blank titles fall back to the derived one.
 * @returns the title, its provenance, sources, and link names.
 */
export function buildPlan(sources: readonly string[], options?: { title?: string }): SelectionPlan {
  const override = options?.title?.trim()
  const titleAuto = override === undefined || override === ''
  const names = sources.map(basenameOf)
  const title = titleAuto ? deriveTitleFromPaths(sources) : (override as string)
  // The manifest's own name is never available as a member entry.
  const linkNames = assignLinkNames(names, [MANIFEST_FILE])
  const links = linkNames.map((name, index) => ({ name, target: sources[index] as string }))
  return { title, titleAuto, sources: [...sources], links }
}

/**
 * Plan the symlinks one add operation appends. Names are kept unique against
 * the entries already in the directory, so a second `src` becomes `src-2`.
 * @param existing - links already present, in their current order.
 * @param sources - canonical directories to append, in the operator's pick order.
 * @returns the new links, in the same order as {@link sources}.
 */
export function planAddition(
  existing: readonly WorkspaceLink[],
  sources: readonly string[],
): WorkspaceLink[] {
  const names = assignLinkNames(sources.map(basenameOf), [
    MANIFEST_FILE,
    ...existing.map(link => link.name),
  ])
  return names.map((name, index) => ({ name, target: sources[index] as string }))
}

/** One completed removal plan. */
export interface RemovalPlan {
  /** Links that stay, in their original order. */
  remaining: WorkspaceLink[]
  /** Links that the removal drops. */
  removed: WorkspaceLink[]
}

/**
 * Plan a removal by entry name, refusing to leave fewer than two members.
 * @param existing - links currently in the directory.
 * @param names - entry names to drop.
 * @param minMembers - fewest members that may remain.
 * @returns the surviving and removed links.
 * @throws {SelectionError} `member-unknown` or `too-few-members`.
 */
export function planRemoval(
  existing: readonly WorkspaceLink[],
  names: readonly string[],
  minMembers: number,
): RemovalPlan {
  const wanted = new Set(names)
  for (const name of wanted) {
    if (!existing.some(link => link.name === name)) {
      throw new SelectionError('member-unknown', `"${name}" is not a folder of this workspace.`)
    }
  }
  const removed = existing.filter(link => wanted.has(link.name))
  const remaining = existing.filter(link => !wanted.has(link.name))
  if (remaining.length < minMembers) {
    throw new SelectionError(
      'too-few-members',
      `A combined workspace needs at least ${minMembers} folders; remove at most ${existing.length - minMembers}.`,
    )
  }
  return { remaining, removed }
}
