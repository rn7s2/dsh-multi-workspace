/**
 * Pure naming rules shared by the Host materializer, the Client dialog preview,
 * and the unit tests. This module must stay browser-safe: no `node:*` imports.
 *
 * @module dsh-multi-workspace/shared/naming
 */

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
 * @param taken - entry names already used by the workspace, kept untouched.
 * @returns entry names in the same order.
 */
export function assignLinkNames(folderNames: readonly string[], taken: readonly string[] = []): string[] {
  const used = new Set(taken.map(name => name.toLowerCase()))
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
 * Whether a title is still the automatic one derived from its folders. A title
 * that differs was chosen by the operator and must survive membership changes.
 * @param title - stored Workspace title.
 * @param paths - current member folders.
 * @returns true when the title can be recomputed safely.
 */
export function isDerivedTitle(title: string, paths: readonly string[]): boolean {
  if (paths.length === 0) return false
  return title === deriveTitleFromPaths(paths)
}

/**
 * Whether a title is one this plugin derived, including the ` (2)` collision
 * suffix {@link uniqueTitle} may have added. Without this, a suffixed automatic
 * title would be mistaken for one the operator chose and stop updating.
 * @param title - stored Workspace title.
 * @param paths - current member folders.
 * @returns true when the title is automatic and may be recomputed.
 */
export function isAutoTitle(title: string, paths: readonly string[]): boolean {
  if (isDerivedTitle(title, paths)) return true
  if (paths.length === 0) return false
  const derived = deriveTitleFromPaths(paths)
  return (
    title.length > derived.length
    && title.startsWith(`${derived} (`)
    && /^\(\d+\)$/.test(title.slice(derived.length + 1))
  )
}

/**
 * Make an automatic title unique among the Workspace titles already in use.
 * Different folders may share base names, and shared titles make the sidebar
 * ambiguous, so later duplicates get a ` (2)`, ` (3)`, ... suffix.
 * @param desired - fresh title derived from the members.
 * @param taken - titles of every other Workspace.
 * @returns `desired`, or its first free suffixed variant.
 */
export function uniqueTitle(desired: string, taken: readonly string[]): string {
  const used = new Set(taken)
  if (!used.has(desired)) return desired
  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const candidate = `${desired} (${suffix})`
    if (!used.has(candidate)) return candidate
  }
  return `${desired} (${Date.now()})`
}
