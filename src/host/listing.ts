/**
 * Host side of the in-app directory browser.
 *
 * The Web profile cannot show an operating-system folder panel: the Host may
 * be a remote Linux machine with no display, and any panel would open on the
 * host's screen rather than in the operator's browser. This module serves the
 * small read-only listing primitive the browser dialog needs, so the Web
 * profile can pick several folders without depending on an OS dialog.
 *
 * Only directories are returned; files are skipped. Symlinks are followed to
 * decide whether they name a directory. The listing is bounded so a huge level
 * cannot exhaust memory or the wire.
 *
 * @module dsh-multi-workspace/host/listing
 */
import { readdir, stat } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import type { DirectoryEntry, DirectoryListing } from '../shared/listing.js'

/** Most child directories one listing returns. */
export const MAX_LISTING_ENTRIES = 2000

/** Stable reason a listing request was rejected. */
export type ListingErrorCode = 'path-not-absolute' | 'path-missing' | 'path-not-directory' | 'listing-failed'

/**
 * Rejection raised while building one directory listing. The transport maps
 * {@link ListingError.code} onto a stable Remote failure.
 */
export class ListingError extends Error {
  /** Stable machine-readable reason. */
  readonly code: ListingErrorCode

  constructor(code: ListingErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ListingError'
    this.code = code
  }
}

/** Inputs of {@link buildDirectoryListing}. */
export interface ListingOptions {
  /** Home directory used when no target is supplied; defaults to `os.homedir()`. */
  home?: string
  /** Most child directories to return; defaults to {@link MAX_LISTING_ENTRIES}. */
  limit?: number
}

/**
 * Whether one dirent names a directory, following symlinks.
 * @param parent - listed directory.
 * @param entry - dirent to classify.
 * @returns true for directories and symlinks that resolve to directories.
 */
async function isDirectoryEntry(
  parent: string,
  entry: { name: string; isDirectory: () => boolean; isSymbolicLink: () => boolean },
): Promise<boolean> {
  if (entry.isDirectory()) return true
  if (!entry.isSymbolicLink()) return false
  try {
    return (await stat(join(parent, entry.name))).isDirectory()
  } catch {
    // A broken or unreadable link is not a usable folder row.
    return false
  }
}

/**
 * Ancestor chain from the filesystem root to one directory.
 * @param target - absolute directory.
 * @returns root-first crumbs; the root crumb carries its full path as its name.
 */
export function crumbsOf(target: string): DirectoryEntry[] {
  const crumbs: DirectoryEntry[] = []
  let current = target
  while (true) {
    const parent = dirname(current)
    if (parent === current) {
      crumbs.push({ name: current, path: current, hidden: false })
      break
    }
    crumbs.push({ name: basename(current), path: current, hidden: false })
    current = parent
  }
  return crumbs.reverse()
}

/**
 * Build one directory level for the browser dialog.
 * @param targetPath - absolute directory to list; absent lists {@link ListingOptions.home}.
 * @param options - home directory and result bound.
 * @returns the level, its ancestry, and whether it was truncated.
 * @throws {ListingError} for a relative or missing target, a non-directory, or an unreadable level.
 */
export async function buildDirectoryListing(
  targetPath?: string,
  options: ListingOptions = {},
): Promise<DirectoryListing> {
  const home = resolve(options.home ?? homedir())
  if (targetPath !== undefined && !isAbsolute(targetPath)) {
    throw new ListingError('path-not-absolute', `Folder path must be absolute: "${targetPath}".`)
  }
  const target = targetPath === undefined ? home : resolve(targetPath)
  const limit = Math.max(1, options.limit ?? MAX_LISTING_ENTRIES)

  let info: Awaited<ReturnType<typeof stat>>
  try {
    info = await stat(target)
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) {
      throw new ListingError('path-missing', `Folder does not exist: "${target}".`, { cause: error })
    }
    throw new ListingError('listing-failed', `Could not open folder "${target}".`, { cause: error })
  }
  if (!info.isDirectory()) {
    throw new ListingError('path-not-directory', `Not a directory: "${target}".`)
  }

  let dirents: Dirent[]
  try {
    dirents = await readdir(target, { withFileTypes: true })
  } catch (error) {
    throw new ListingError('listing-failed', `Could not list folder "${target}".`, { cause: error })
  }

  const entries: DirectoryEntry[] = []
  for (const dirent of dirents) {
    if (!(await isDirectoryEntry(target, dirent))) continue
    const path = join(target, dirent.name)
    entries.push({ name: dirent.name, path, hidden: dirent.name.startsWith('.') })
  }
  entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  const truncated = entries.length > limit
  if (truncated) entries.length = limit

  return { path: target, home, crumbs: crumbsOf(target), entries, truncated }
}

/**
 * Test an unknown error's `code` property.
 * @param error - unknown rejection.
 * @param code - expected Node error code.
 * @returns true when the error carries the code.
 */
function isErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  )
}
