import { describe, expect, it } from 'vitest'
import { SelectionError, buildPlan, uniqueDirectoryName } from '../src/host/core.js'
import type { SelectionErrorCode } from '../src/host/core.js'
import { MAX_SLUG_LENGTH, slugify } from '../src/shared/naming.js'

describe('buildPlan titles', () => {
  it('uses the single folder name unchanged', () => {
    expect(buildPlan(['/Users/me/alpha']).title).toBe('alpha')
  })

  it('joins two folder names with "and"', () => {
    expect(buildPlan(['/Users/me/alpha', '/Users/me/beta']).title).toBe('alpha and beta')
  })

  it('joins three folder names with commas and a final "and"', () => {
    expect(buildPlan(['/a/one', '/b/two', '/c/three']).title).toBe('one, two and three')
  })

  it('joins five folder names with commas and a final "and"', () => {
    expect(buildPlan(['/a/A', '/b/B', '/c/C', '/d/D', '/e/E']).title).toBe('A, B, C, D and E')
  })

  it('keeps CJK folder names in the title and falls back to a workspace slug', () => {
    const plan = buildPlan(['/Users/me/项目一', '/Users/me/项目二'])
    expect(plan.title).toBe('项目一 and 项目二')
    expect(plan.slug).toBe('workspace')
    expect(buildPlan(['/Users/me/项目一'], { title: '纯中文标题' }).slug).toBe('workspace')
  })

  it('builds the auto slug from folder names, never from the join connectives', () => {
    expect(buildPlan(['/a/alpha', '/b/beta', '/c/gamma']).slug).toBe('alpha-beta-gamma')
    expect(buildPlan(['/a/alpha', '/b/beta']).slug).toBe('alpha-beta')
    expect(buildPlan(['/a/one']).slug).toBe('one')
  })

  it('keeps spaces in the title and slugifies them', () => {
    const plan = buildPlan(['/Users/me/My Folder'])
    expect(plan.title).toBe('My Folder')
    expect(plan.slug).toBe('my-folder')
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
    const plan = buildPlan(['/Users/me/work/project/'])
    expect(plan.links).toEqual([{ name: 'project', target: '/Users/me/work/project/' }])
  })
})

describe('buildPlan title override and slug', () => {
  it('prefers a trimmed explicit title', () => {
    const plan = buildPlan(['/a/one', '/b/two'], { title: '  Custom Name  ' })
    expect(plan.title).toBe('Custom Name')
    expect(plan.slug).toBe('custom-name')
    expect(plan.links.map(link => link.name)).toEqual(['one', 'two'])
  })

  it('falls back to the derived title when the override is blank', () => {
    expect(buildPlan(['/a/one', '/b/two'], { title: '   ' }).title).toBe('one and two')
    expect(buildPlan(['/a/one'], { title: '' }).title).toBe('one')
  })

  it('matches the shared slugify rules for punctuation and casing', () => {
    const title = 'Release  Notes -- October 2026!!'
    const plan = buildPlan(['/a/one'], { title })
    expect(plan.slug).toBe(slugify(title))
    expect(plan.slug).toBe('release-notes-october-2026')
  })

  it('drops non-ASCII characters from a mixed title', () => {
    expect(buildPlan(['/a/one'], { title: '项目 Plan' }).slug).toBe('plan')
  })

  it('caps the slug at MAX_SLUG_LENGTH characters', () => {
    const plan = buildPlan(['/a/one'], { title: 'x'.repeat(MAX_SLUG_LENGTH + 20) })
    expect(plan.slug).toBe('x'.repeat(MAX_SLUG_LENGTH))
    expect(plan.slug.length).toBe(MAX_SLUG_LENGTH)
  })
})

describe('uniqueDirectoryName', () => {
  it('returns the slug when it is free', () => {
    expect(uniqueDirectoryName('demo', () => false)).toBe('demo')
  })

  it('tries numbered suffixes in order and stops at the first free one', () => {
    const taken = new Set(['demo', 'demo-2', 'demo-3'])
    const probes: string[] = []
    const name = uniqueDirectoryName('demo', candidate => {
      probes.push(candidate)
      return taken.has(candidate)
    })
    expect(name).toBe('demo-4')
    expect(probes).toEqual(['demo', 'demo-2', 'demo-3', 'demo-4'])
  })

  it('falls back to a timestamped name when 2..999 are taken', () => {
    const taken = new Set(['demo'])
    for (let suffix = 2; suffix <= 999; suffix += 1) taken.add(`demo-${suffix}`)
    const name = uniqueDirectoryName('demo', candidate => taken.has(candidate))
    expect(name).toMatch(/^demo-\d+$/)
    expect(taken.has(name)).toBe(false)
    const timestamp = Number(name.slice('demo-'.length))
    expect(Math.abs(timestamp - Date.now())).toBeLessThan(5_000)
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
    ]
    for (const code of codes) {
      expect(new SelectionError(code, 'message').code).toBe(code)
    }
  })
})
