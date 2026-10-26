/**
 * Pure naming rules shared by the Host materializer, the Client dialog preview,
 * and the unit tests. This module must stay browser-safe: no `node:*` imports.
 *
 * @module dsh-multi-workspace/shared/naming
 */

/** Longest slug (directory segment) the plugin produces, before uniqueness suffixes. */
export const MAX_SLUG_LENGTH = 60

/** Hard cap of folders one combined workspace may contain. */
export const HARD_MAX_PATHS = 64

/**
 * Last path segment of a POSIX or Windows path, without requiring `node:path`.
 * Trailing separators are ignored.
 * @param path - host path as returned by the directory picker.
 * @returns the final folder name; `/` and `C:\` return their own spelling.
 */
export function basenameOf(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  if (trimmed === '') return path.startsWith('/') ? '/' : path
  const separator = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  const name = separator >= 0 ? trimmed.slice(separator + 1) : trimmed
  if (name === '') return trimmed
  if (/^[A-Za-z]:$/.test(trimmed) && name === trimmed) return trimmed
  return name
}

/**
 * Derive the default Workspace title from folder names:
 * `A`, `A and B`, or `A, B and C` in selection order.
 * @param names - folder display names in the operator's selection order.
 * @returns the joined title.
 * @throws Error when no non-blank name is supplied.
 */
export function deriveTitle(names: readonly string[]): string {
  const cleaned = names.map(name => name.trim()).filter(name => name !== '')
  if (cleaned.length === 0) throw new Error('deriveTitle requires at least one folder name')
  if (cleaned.length === 1) return cleaned[0] as string
  const head = cleaned.slice(0, -1).join(', ')
  const last = cleaned[cleaned.length - 1] as string
  return `${head} and ${last}`
}

/**
 * Lower-case ASCII slug used as the real combined-workspace directory name.
 * @param title - source text (usually the derived title).
 * @returns `[a-z0-9-]+`, at most {@link MAX_SLUG_LENGTH} characters, never empty.
 */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  if (slug === '') return 'workspace'
  if (slug.length <= MAX_SLUG_LENGTH) return slug
  return slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '') || 'workspace'
}

/**
 * Make one source folder name safe as a directory entry inside the combined
 * workspace: separators and control characters are replaced, and `.`/`..` are
 * never produced.
 * @param name - raw folder name.
 * @returns a non-empty, separator-free entry name.
 */
export function sanitizeLinkName(name: string): string {
  const cleaned = name
    .replace(/[\\/\u0000-\u001f]/g, '-')
    .trim()
  if (cleaned === '' || cleaned === '.' || cleaned === '..') return 'folder'
  return cleaned
}

/**
 * Assign unique symlink names for the selected folders. Uniqueness is
 * case-insensitive because the common host filesystems are; the first
 * occurrence keeps its name, later collisions get `-2`, `-3`, ...
 * @param folderNames - folder names in selection order (already sanitized or not).
 * @returns entry names in the same order.
 */
export function assignLinkNames(folderNames: readonly string[]): string[] {
  const used = new Set<string>()
  const names: string[] = []
  for (const raw of folderNames) {
    const base = sanitizeLinkName(raw)
    let candidate = base
    let suffix = 2
    while (used.has(candidate.toLowerCase())) {
      candidate = `${base}-${suffix}`
      suffix += 1
    }
    used.add(candidate.toLowerCase())
    names.push(candidate)
  }
  return names
}

/**
 * Derive the Workspace title from absolute source paths: basenames in selection
 * order joined by the `A, B and C` rule.
 * @param paths - absolute folder paths.
 * @returns the default title.
 */
export function deriveTitleFromPaths(paths: readonly string[]): string {
  return deriveTitle(paths.map(basenameOf))
}

/**
 * Directory slug for the auto-derived name: the folder names joined with `-`
 * and slugified, so the `,`/` and ` connectives of the display title never
 * leak into the real directory name (`alpha-beta-gamma`, not
 * `alpha-beta-and-gamma`). A selection with no ASCII folder name falls back to
 * `workspace`.
 * @param folderNames - folder display names in selection order.
 * @returns a `[a-z0-9-]+` slug.
 */
export function slugFromFolderNames(folderNames: readonly string[]): string {
  return slugify(folderNames.join('-'))
}
