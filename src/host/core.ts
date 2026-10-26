/**
 * Pure planning rules and the error taxonomy used while creating a combined
 * workspace. Everything here is filesystem-free so the same rules can be unit
 * tested without a temporary directory; the filesystem side lives in
 * `./fs.ts`.
 *
 * @module dsh-multi-workspace/host/core
 */
import type { WorkspaceLink } from '../shared/rpc.js'
import {
  assignLinkNames,
  basenameOf,
  deriveTitleFromPaths,
  slugFromFolderNames,
  slugify,
} from '../shared/naming.js'

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
  /** Lower-case directory segment before uniqueness suffixes. */
  slug: string
  /** Source directories in selection order (canonicalized by the caller). */
  sources: string[]
  /** Symlink entries to create, in the same order as {@link sources}. */
  links: WorkspaceLink[]
}

/**
 * Build the immutable description of a combined workspace.
 * @param sources - absolute source directories in selection order.
 * @param options - optional explicit title; blank titles fall back to the derived one.
 * @returns the title, slug, sources, and link names.
 */
export function buildPlan(sources: readonly string[], options?: { title?: string }): SelectionPlan {
  const override = options?.title?.trim()
  const names = sources.map(basenameOf)
  const title =
    override !== undefined && override !== '' ? override : deriveTitleFromPaths(sources)
  const slug =
    override !== undefined && override !== '' ? slugify(override) : slugFromFolderNames(names)
  const linkNames = assignLinkNames(names)
  const links = linkNames.map((name, index) => ({ name, target: sources[index] as string }))
  return { title, slug, sources: [...sources], links }
}

/** Lowest numeric disambiguation suffix appended to a taken slug. */
const FIRST_SUFFIX = 2

/** Highest numeric disambiguation suffix tried before falling back to a timestamp. */
const LAST_SUFFIX = 999

/**
 * Pick the first free directory name for a slug.
 * Tries the slug itself, then `-2` through `-999`, and finally a timestamped
 * name. The caller owns the filesystem probe so this stays a pure function.
 * @param slug - slugified title.
 * @param taken - returns true when the candidate name is already in use.
 * @returns an unused directory name.
 */
export function uniqueDirectoryName(slug: string, taken: (candidate: string) => boolean): string {
  if (!taken(slug)) return slug
  for (let suffix = FIRST_SUFFIX; suffix <= LAST_SUFFIX; suffix += 1) {
    const candidate = `${slug}-${suffix}`
    if (!taken(candidate)) return candidate
  }
  return `${slug}-${Date.now()}`
}
