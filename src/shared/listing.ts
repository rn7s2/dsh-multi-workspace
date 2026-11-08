/**
 * Browser-safe types of the in-app directory browser. The Host lists one
 * level at a time; the Client renders it and accumulates a multi-folder
 * selection. Paths are always absolute and assembled by the Host, so the
 * Client never joins path segments itself.
 *
 * @module dsh-multi-workspace/shared/listing
 */

/** One directory row: a listing child or a breadcrumb ancestor. */
export interface DirectoryEntry {
  /** Base name shown in a browser row (the root crumb carries its full path). */
  name: string
  /** Absolute host path; the Client only ever navigates to this value. */
  path: string
  /** Hidden by the host convention (dot-prefixed on POSIX); the Client decides whether to show it. */
  hidden: boolean
}

/** One directory level plus its ancestry, as the Host returns it. */
export interface DirectoryListing {
  /** Absolute path of the listed directory. */
  path: string
  /** The host account's home directory (the dialog's "Home" crumb). */
  home: string
  /** Ancestor chain from the filesystem root to the listed directory inclusive. */
  crumbs: DirectoryEntry[]
  /** Direct child directories, name-sorted; symlinks to directories included. */
  entries: DirectoryEntry[]
  /** True when the level was cut at the Host's complete-result bound. */
  truncated: boolean
}
