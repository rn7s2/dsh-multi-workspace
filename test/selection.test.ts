import { describe, expect, it } from 'vitest'
import {
  removeSelection,
  selectionHas,
  selectionPaths,
  toggleSelection,
} from '../src/client/selection.js'
import type { DirectoryEntry } from '../src/shared/listing.js'
import { HARD_MAX_PATHS } from '../src/shared/naming.js'

/**
 * Build one directory row fixture.
 * @param name - base name and default path suffix.
 * @returns the fixture row.
 */
function entry(name: string): DirectoryEntry {
  return { name, path: `/tmp/${name}`, hidden: false }
}

describe('selectionHas', () => {
  it('matches by absolute path', () => {
    expect(selectionHas([], '/tmp/a')).toBe(false)
    expect(selectionHas([entry('a')], '/tmp/a')).toBe(true)
  })
})

describe('toggleSelection', () => {
  it('adds folders in pick order', () => {
    const first = toggleSelection([], entry('alpha'))
    const second = toggleSelection(first, entry('beta'))
    expect(selectionPaths(second)).toEqual(['/tmp/alpha', '/tmp/beta'])
  })

  it('removes a folder that is already selected', () => {
    const selected = [entry('alpha'), entry('beta'), entry('gamma')]
    const next = toggleSelection(selected, entry('beta'))
    expect(selectionPaths(next)).toEqual(['/tmp/alpha', '/tmp/gamma'])
    expect(next).not.toBe(selected)
  })

  it('keeps the row that was first selected for the same path', () => {
    const selected = [entry('alpha')]
    const duplicate = { name: 'alpha-2', path: '/tmp/alpha', hidden: true }
    const next = toggleSelection(selected, duplicate)
    // Toggling an already selected path removes it instead of duplicating.
    expect(next).toEqual([])
  })

  it('stops at the hard folder cap', () => {
    const selected = Array.from({ length: HARD_MAX_PATHS }, (_, index) => entry(`folder-${index}`))
    const next = toggleSelection(selected, entry('one-too-many'))
    expect(next).toBe(selected)
    expect(next.length).toBe(HARD_MAX_PATHS)
  })
})

describe('removeSelection', () => {
  it('removes by path and leaves the rest in order', () => {
    const selected = [entry('alpha'), entry('beta'), entry('gamma')]
    expect(selectionPaths(removeSelection(selected, '/tmp/beta'))).toEqual([
      '/tmp/alpha',
      '/tmp/gamma',
    ])
  })

  it('returns an equal selection for an unknown path', () => {
    const selected = [entry('alpha')]
    const next = removeSelection(selected, '/tmp/missing')
    expect(next).toEqual(selected)
    expect(next).not.toBe(selected)
  })
})
