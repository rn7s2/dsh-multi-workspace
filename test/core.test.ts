import { describe, expect, it } from 'vitest'
import { SelectionError, buildPlan, planAddition, planRemoval } from '../src/host/core.js'
import type { SelectionErrorCode } from '../src/host/core.js'
import { isDerivedTitle, uniqueTitle } from '../src/shared/naming.js'

describe('buildPlan titles', () => {
  it('uses the single folder name unchanged', () => {
    expect(buildPlan(['/example/alpha']).title).toBe('alpha')
  })

  it('joins two folder names with "and"', () => {
    expect(buildPlan(['/example/alpha', '/example/beta']).title).toBe('alpha and beta')
  })

  it('joins three folder names with commas and a final "and"', () => {
    expect(buildPlan(['/a/one', '/b/two', '/c/three']).title).toBe('one, two and three')
  })

  it('joins five folder names with commas and a final "and"', () => {
    expect(buildPlan(['/a/A', '/b/B', '/c/C', '/d/D', '/e/E']).title).toBe('A, B, C, D and E')
  })

  it('keeps CJK folder names in the title', () => {
    const plan = buildPlan(['/example/项目一', '/example/项目二'])
    expect(plan.title).toBe('项目一 and 项目二')
    expect(plan.titleAuto).toBe(true)
  })

  it('keeps spaces in the title', () => {
    const plan = buildPlan(['/example/My Folder'])
    expect(plan.title).toBe('My Folder')
  })

  it('preserves selection order for titles, sources, and links', () => {
    const sources = ['/z/zulu', '/a/alpha', '/m/mike']
    const plan = buildPlan(sources)
    expect(plan.title).toBe('zulu, alpha and mike')
    expect(plan.sources).toEqual(sources)
    expect(plan.links.map(link => link.target)).toEqual(sources)
    expect(plan.links.map(link => link.name)).toEqual(['zulu', 'alpha', 'mike'])
  })

  it('does not mutate the caller-owned source array', () => {
    const sources = ['/a/one', '/b/two']
    const plan = buildPlan(sources)
    plan.sources.push('/c/three')
    expect(sources).toEqual(['/a/one', '/b/two'])
  })
})

describe('buildPlan link names', () => {
  it('suffixes duplicate basenames in selection order', () => {
    const plan = buildPlan(['/a/docs', '/b/docs', '/c/docs'])
    expect(plan.title).toBe('docs, docs and docs')
    expect(plan.links).toEqual([
      { name: 'docs', target: '/a/docs' },
      { name: 'docs-2', target: '/b/docs' },
      { name: 'docs-3', target: '/c/docs' },
    ])
  })

  it('treats basename collisions case-insensitively', () => {
    const plan = buildPlan(['/a/Reports', '/b/reports'])
    expect(plan.links.map(link => link.name)).toEqual(['Reports', 'reports-2'])
  })

  it('uses the final path segment as the link name', () => {
    const plan = buildPlan(['/example/work/project/'])
    expect(plan.links).toEqual([{ name: 'project', target: '/example/work/project/' }])
  })
})

describe('buildPlan title override', () => {
  it('prefers a trimmed explicit title and marks it manual', () => {
    const plan = buildPlan(['/a/one', '/b/two'], { title: '  Custom Name  ' })
    expect(plan.title).toBe('Custom Name')
    expect(plan.titleAuto).toBe(false)
    expect(plan.links.map(link => link.name)).toEqual(['one', 'two'])
  })

  it('falls back to the derived title when the override is blank', () => {
    expect(buildPlan(['/a/one', '/b/two'], { title: '   ' })).toMatchObject({
      title: 'one and two',
      titleAuto: true,
    })
    expect(buildPlan(['/a/one'], { title: '' })).toMatchObject({ title: 'one', titleAuto: true })
  })
})

describe('planAddition', () => {
  const existing = [
    { name: 'alpha', target: '/src/alpha' },
    { name: 'docs', target: '/src/first/docs' },
  ]

  it('appends new links in the order given', () => {
    const added = planAddition(existing, ['/src/beta', '/src/gamma'])
    expect(added).toEqual([
      { name: 'beta', target: '/src/beta' },
      { name: 'gamma', target: '/src/gamma' },
    ])
  })

  it('avoids names already used by the directory', () => {
    const added = planAddition(existing, ['/src/second/docs'])
    expect(added).toEqual([{ name: 'docs-2', target: '/src/second/docs' }])
  })

  it('keeps the new batch unique against itself as well', () => {
    const added = planAddition(existing, ['/a/docs', '/b/docs', '/c/DOCS'])
    expect(added.map(link => link.name)).toEqual(['docs-2', 'docs-3', 'DOCS-4'])
  })

  it('does not mutate the existing links', () => {
    planAddition(existing, ['/src/beta'])
    expect(existing.map(link => link.name)).toEqual(['alpha', 'docs'])
  })
})

describe('planRemoval', () => {
  const existing = [
    { name: 'alpha', target: '/src/alpha' },
    { name: 'beta', target: '/src/beta' },
    { name: 'gamma', target: '/src/gamma' },
  ]

  it('splits the members into survivors and removals, keeping order', () => {
    const plan = planRemoval(existing, ['beta'], 2)
    expect(plan.remaining.map(link => link.name)).toEqual(['alpha', 'gamma'])
    expect(plan.removed.map(link => link.name)).toEqual(['beta'])
  })

  it('accepts removing several members at once', () => {
    const plan = planRemoval(existing, ['alpha', 'gamma'], 1)
    expect(plan.remaining.map(link => link.name)).toEqual(['beta'])
    expect(plan.removed.map(link => link.name)).toEqual(['alpha', 'gamma'])
  })

  it('refuses to go below the member floor', () => {
    expect(() => planRemoval(existing, ['beta', 'gamma'], 2)).toThrow(SelectionError)
    try {
      planRemoval(existing, ['beta', 'gamma'], 2)
    } catch (error) {
      expect((error as SelectionError).code).toBe('too-few-members')
      expect((error as SelectionError).message).toContain('at least 2')
    }
  })

  it('rejects an unknown member name', () => {
    try {
      planRemoval(existing, ['delta'], 2)
    } catch (error) {
      expect((error as SelectionError).code).toBe('member-unknown')
      expect((error as SelectionError).message).toContain('delta')
    }
    expect(() => planRemoval(existing, ['delta'], 2)).toThrow(SelectionError)
  })
})

describe('title helpers', () => {
  it('recognizes a title that is still derived from the folders', () => {
    expect(isDerivedTitle('alpha and beta', ['/a/alpha', '/b/beta'])).toBe(true)
    expect(isDerivedTitle('My Workspace', ['/a/alpha', '/b/beta'])).toBe(false)
    expect(isDerivedTitle('anything', [])).toBe(false)
  })

  it('leaves a free title alone', () => {
    expect(uniqueTitle('alpha and beta', ['other'])).toBe('alpha and beta')
  })

  it('suffixes a title another workspace already uses', () => {
    expect(uniqueTitle('docs and docs', ['docs and docs'])).toBe('docs and docs (2)')
    expect(uniqueTitle('docs and docs', ['docs and docs', 'docs and docs (2)'])).toBe('docs and docs (3)')
  })
})

describe('SelectionError', () => {
  it('preserves the code, message, name, and cause', () => {
    const cause = new Error('disk full')
    const error = new SelectionError('materialize-failed', 'Could not create the workspace.', { cause })
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('SelectionError')
    expect(error.code).toBe('materialize-failed')
    expect(error.message).toBe('Could not create the workspace.')
    expect(error.cause).toBe(cause)
  })

  it('works without a cause', () => {
    const error = new SelectionError('empty-selection', 'No folders were selected.')
    expect(error.code).toBe('empty-selection')
    expect(error.cause).toBeUndefined()
  })

  it('accepts every declared code', () => {
    const codes: SelectionErrorCode[] = [
      'empty-selection',
      'too-few-paths',
      'too-many-paths',
      'path-not-absolute',
      'path-missing',
      'path-not-directory',
      'duplicate-path',
      'inside-workspace-root',
      'root-unavailable',
      'materialize-failed',
      'not-combined',
      'member-unknown',
      'too-few-members',
      'last-member',
    ]
    for (const code of codes) {
      expect(new SelectionError(code, 'message').code).toBe(code)
    }
  })
})
