import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildDirectoryListing,
  crumbsOf,
  ListingError,
  MAX_LISTING_ENTRIES,
} from '../src/host/listing.js'
import type { ListingErrorCode } from '../src/host/listing.js'

let base: string

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'dsh-multi-workspace-listing-'))
})

afterEach(async () => {
  await rm(base, { recursive: true, force: true })
})

/**
 * Create a directory below the per-test base directory.
 * @param segments - path segments below the base.
 */
async function makeDir(...segments: string[]): Promise<string> {
  const dir = join(base, ...segments)
  await mkdir(dir, { recursive: true })
  return dir
}

/**
 * Await a rejection and assert it is a ListingError with the expected code.
 * @param run - operation expected to reject.
 * @param code - expected ListingError code.
 */
async function expectListingError(
  run: () => Promise<unknown>,
  code: ListingErrorCode,
): Promise<ListingError> {
  const outcome = await run().then(
    () => undefined,
    (error: unknown) => error,
  )
  expect(outcome).toBeInstanceOf(ListingError)
  const error = outcome as ListingError
  expect(error.code).toBe(code)
  return error
}

describe('buildDirectoryListing', () => {
  it('returns only directories, name-sorted, with hidden flags', async () => {
    const level = await makeDir('level')
    await makeDir('level', 'beta')
    await makeDir('level', 'Alpha')
    await makeDir('level', '.hidden')
    await writeFile(join(level, 'note.txt'), 'not a folder')

    const listing = await buildDirectoryListing(level, { home: resolve(base) })
    expect(listing.path).toBe(resolve(level))
    expect(listing.entries).toEqual([
      { name: '.hidden', path: join(resolve(level), '.hidden'), hidden: true },
      { name: 'Alpha', path: join(resolve(level), 'Alpha'), hidden: false },
      { name: 'beta', path: join(resolve(level), 'beta'), hidden: false },
    ])
    expect(listing.truncated).toBe(false)
  })

  it('follows directory symlinks and skips non-directory links', async () => {
    const level = await makeDir('links')
    const target = await makeDir('links', 'target')
    const file = join(level, 'file.txt')
    await writeFile(file, 'x')
    await symlink(target, join(level, 'to-dir'))
    await symlink(file, join(level, 'to-file'), 'file')
    await symlink(join(level, 'missing'), join(level, 'broken'))

    const listing = await buildDirectoryListing(level)
    expect(listing.entries.map(entry => entry.name)).toEqual(['target', 'to-dir'])
  })

  it('reports the home directory when no target is given', async () => {
    const home = await makeDir('home')
    await makeDir('home', 'project')
    const listing = await buildDirectoryListing(undefined, { home })
    expect(listing.path).toBe(resolve(home))
    expect(listing.home).toBe(resolve(home))
    expect(listing.entries.map(entry => entry.name)).toEqual(['project'])
  })

  it('cuts a large level at the bound and flags it', async () => {
    const level = await makeDir('many')
    for (const name of ['a', 'b', 'c', 'd', 'e']) await makeDir('many', name)
    const listing = await buildDirectoryListing(level, { limit: 2 })
    expect(listing.entries.map(entry => entry.name)).toEqual(['a', 'b'])
    expect(listing.truncated).toBe(true)
    expect(MAX_LISTING_ENTRIES).toBeGreaterThan(2)
  })

  it('rejects a relative path', async () => {
    const error = await expectListingError(
      () => buildDirectoryListing('relative/folder'),
      'path-not-absolute',
    )
    expect(error.message).toMatch(/absolute/i)
  })

  it('rejects a missing directory', async () => {
    await expectListingError(() => buildDirectoryListing(join(base, 'missing')), 'path-missing')
  })

  it('rejects a file', async () => {
    const file = join(base, 'file.txt')
    await writeFile(file, 'x')
    await expectListingError(() => buildDirectoryListing(file), 'path-not-directory')
  })
})

describe('crumbsOf', () => {
  it('returns root-first ancestors ending at the target', async () => {
    const target = await makeDir('a', 'b', 'c')
    const crumbs = crumbsOf(resolve(target))
    expect(crumbs[0]).toEqual({ name: resolve('/'), path: resolve('/'), hidden: false })
    expect(crumbs.at(-1)?.path).toBe(resolve(target))
    expect(crumbs.map(crumb => crumb.name)).toContain('a')
    expect(crumbs.map(crumb => crumb.name)).toContain('b')
    expect(crumbs.map(crumb => crumb.name)).toContain('c')
  })
})
