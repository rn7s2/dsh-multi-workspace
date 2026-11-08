/**
 * Pure selection rules of the in-app multi-folder dialog. Kept free of React
 * and Node imports so the same rules are unit tested and shared by the flow.
 *
 * @module dsh-multi-workspace/client/selection
 */
import type { DirectoryEntry } from '../shared/listing.js'
import { HARD_MAX_PATHS } from '../shared/naming.js'

/**
 * Whether one folder is already in the selection.
 * @param selected - current selection in pick order.
 * @param path - absolute folder path.
 * @returns true when the path is selected.
 */
export function selectionHas(selected: readonly DirectoryEntry[], path: string): boolean {
  return selected.some(entry => entry.path === path)
}

/**
 * Add or remove one folder, preserving pick order.
 * @param selected - current selection in pick order.
 * @param entry - folder row to toggle.
 * @returns the next selection; the same array reference when the hard cap is reached.
 */
export function toggleSelection(
  selected: readonly DirectoryEntry[],
  entry: DirectoryEntry,
): DirectoryEntry[] {
  if (selectionHas(selected, entry.path)) {
    return selected.filter(candidate => candidate.path !== entry.path)
  }
  if (selected.length >= HARD_MAX_PATHS) return selected as DirectoryEntry[]
  return [...selected, entry]
}

/**
 * Remove one folder by path.
 * @param selected - current selection in pick order.
 * @param path - absolute folder path.
 * @returns the next selection.
 */
export function removeSelection(
  selected: readonly DirectoryEntry[],
  path: string,
): DirectoryEntry[] {
  return selected.filter(entry => entry.path !== path)
}

/**
 * The absolute paths of a selection, in pick order.
 * @param selected - current selection.
 * @returns the paths handed to the create Remote.
 */
export function selectionPaths(selected: readonly DirectoryEntry[]): string[] {
  return selected.map(entry => entry.path)
}
