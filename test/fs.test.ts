import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, readlink, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SelectionError } from '../src/host/core.js'
import type { SelectionErrorCode } from '../src/host/core.js'
import { materializeWorkspace, removeWorkspaceDirectory, resolveSources } from '../src/host/fs.js'
import { HARD_MAX_PATHS } from '../src/shared/naming.js'
import { MANIFEST_FILE } from '../src/shared/rpc.js'

/** Parsed shape of the hidden manifest written by the Host. */
interface Manifest {
  version: number
  kind: string
  createdAt: string
  title: string
  links: { name: string; target: string }[]
}

let base: string
let rootDir: string
let sourcesDir: string

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'dsh-multi-workspace-'))
  rootDir = join(base, 'root')
  sourcesDir = join(base, 'sources')
  await mkdir(sourcesDir, { recursive: true })
})

afterEach(async () => {
  // Restore traversability in case a test failed between chmod and its own cleanup.
  await chmod(rootDir, 0o700).catch(() => undefined)
  await chmod(sourcesDir, 0o700).catch(() => undefined)
  await rm(base, { recursive: true, force: true })
})

/**
 * Create a directory below the per-test sources root.
 * @param segments - path segments to join below the sources root.
 */
async function makeSource(...segments: string[]): Promise<string> {
  const dir = join(sourcesDir, ...segments)
  await mkdir(dir, { recursive: true })
  return dir
}

/**
 * Await a rejection and assert it is a SelectionError with the expected code.
 * @param run - operation expected to reject.
 * @param code - expected SelectionError code.
 */
async function expectSelectionError(
  run: () => Promise<unknown>,
  code: SelectionErrorCode,
): Promise<SelectionError> {
  const outcome = await run().then(
    () => undefined,
    (error: unknown) => error,
  )
  expect(outcome).toBeInstanceOf(SelectionError)
  const error = outcome as SelectionError
  expect(error.code).toBe(code)
  return error
}

/**
 * The manifest of a directory produced by materializeWorkspace.
 * @param dir - combined workspace directory.
 */
async function readManifest(dir: string): Promise<Manifest> {
  return JSON.parse(await readFile(join(dir, MANIFEST_FILE), 'utf8')) as Manifest
}

describe('resolveSources validation', () => {
  it('rejects an empty selection', async () => {
    const error = await expectSelectionError(() => resolveSources([], { rootDir }), 'empty-selection')
    expect(error.message).toMatch(/no folders/i)
  })

  it('requires two paths by default', async () => {
    const one = await makeSource('one')
    const error = await expectSelectionError(() => resolveSources([one], { rootDir }), 'too-few-paths')
    expect(error.message).toContain('at least 2')
  })

  it('accepts one path when minPaths is 1', async () => {
    const one = await makeSource('one')
    await expect(resolveSources([one], { rootDir, minPaths: 1 })).resolves.toEqual([await realpath(one)])
  })

  it('rejects a selection above the hard limit before touching the filesystem', async () => {
    const paths = Array.from({ length: HARD_MAX_PATHS + 1 }, (_, index) => `/definitely/missing/${index}`)
    const error = await expectSelectionError(() => resolveSources(paths, { rootDir }), 'too-many-paths')
    expect(error.message).toContain(String(HARD_MAX_PATHS))
  })

  it('rejects a relative path', async () => {
    const error = await expectSelectionError(
      () => resolveSources(['relative/folder'], { rootDir, minPaths: 1 }),
      'path-not-absolute',
    )
    expect(error.message).toContain('relative/folder')
  })

  it('rejects a missing path with the path in the message', async () => {
    const missing = join(sourcesDir, 'missing')
    const error = await expectSelectionError(
      () => resolveSources([missing], { rootDir, minPaths: 1 }),
      'path-missing',
    )
    expect(error.message).toContain(missing)
  })

  it('rejects a path that is a file', async () => {
    const file = join(sourcesDir, 'notes.txt')
    await writeFile(file, 'hello')
    const error = await expectSelectionError(
      () => resolveSources([file], { rootDir, minPaths: 1 }),
      'path-not-directory',
    )
    expect(error.message).toContain(file)
  })

  it('rejects the same path selected twice', async () => {
    const one = await makeSource('one')
    const error = await expectSelectionError(() => resolveSources([one, one], { rootDir }), 'duplicate-path')
    expect(error.message).toContain(one)
  })

  it('rejects a second spelling that canonicalizes to an already selected folder', async () => {
    const target = await makeSource('target')
    const alias = join(sourcesDir, 'alias')
    await symlink(target, alias, 'dir')
    const error = await expectSelectionError(
      () => resolveSources([target, alias], { rootDir }),
      'duplicate-path',
    )
    expect(error.message).toContain(alias)
  })

  it('rejects a folder inside the workspace root', async () => {
    await mkdir(rootDir, { recursive: true })
    const inside = join(rootDir, 'nested')
    await mkdir(inside)
    const error = await expectSelectionError(
      () => resolveSources([inside], { rootDir, minPaths: 1 }),
      'inside-workspace-root',
    )
    expect(error.message).toContain(inside)
  })

  it('rejects the workspace root itself', async () => {
    await mkdir(rootDir, { recursive: true })
    await expectSelectionError(
      () => resolveSources([rootDir], { rootDir, minPaths: 1 }),
      'inside-workspace-root',
    )
  })

  it('returns canonical paths in selection order, following symlinks', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const alias = join(sourcesDir, 'alpha-link')
    await symlink(alpha, alias, 'dir')
    await expect(resolveSources([beta, alias], { rootDir })).resolves.toEqual([
      await realpath(beta),
      await realpath(alpha),
    ])
  })
})

describe('materializeWorkspace', () => {
  it('creates a missing root, symlinks, and a manifest', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const expectedSources = [await realpath(alpha), await realpath(beta)]

    const result = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    expect(result.dir).toBe(join(resolve(rootDir), 'alpha-beta'))
    expect(result.title).toBe('alpha and beta')
    expect(result.sources).toEqual(expectedSources)
    expect(result.links).toEqual([
      { name: 'alpha', target: expectedSources[0] },
      { name: 'beta', target: expectedSources[1] },
    ])
    expect((await stat(rootDir)).isDirectory()).toBe(true)
    expect((await lstat(result.dir)).isDirectory()).toBe(true)

    for (const link of result.links) {
      const entry = join(result.dir, link.name)
      expect((await lstat(entry)).isSymbolicLink()).toBe(true)
      expect(await readlink(entry)).toBe(link.target)
      expect(link.target.startsWith('/')).toBe(true)
    }

    const manifest = await readManifest(result.dir)
    expect(manifest.version).toBe(1)
    expect(manifest.kind).toBe('dsh-multi-workspace')
    expect(manifest.title).toBe('alpha and beta')
    expect(manifest.links).toEqual(result.links)
    expect(new Date(manifest.createdAt).toISOString()).toBe(manifest.createdAt)
  })

  it('suffixes symlink names when different parents share a basename', async () => {
    const first = await makeSource('first', 'docs')
    const second = await makeSource('second', 'docs')
    const expectedSources = [await realpath(first), await realpath(second)]

    const result = await materializeWorkspace({ rootDir, paths: [first, second] })

    expect(result.title).toBe('docs and docs')
    expect(result.links.map(link => link.name)).toEqual(['docs', 'docs-2'])
    expect(await readlink(join(result.dir, 'docs'))).toBe(expectedSources[0])
    expect(await readlink(join(result.dir, 'docs-2'))).toBe(expectedSources[1])
    expect(await readManifest(result.dir)).toMatchObject({
      title: 'docs and docs',
      links: [
        { name: 'docs', target: expectedSources[0] },
        { name: 'docs-2', target: expectedSources[1] },
      ],
    })
  })

  it('allocates a -2 directory when the slug directory already exists', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    await mkdir(rootDir, { recursive: true })
    const taken = join(rootDir, 'alpha-beta')
    await mkdir(taken)
    await writeFile(join(taken, 'marker.txt'), 'keep me')

    const result = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    expect(result.dir).toBe(join(resolve(rootDir), 'alpha-beta-2'))
    expect(await readFile(join(taken, 'marker.txt'), 'utf8')).toBe('keep me')
    expect((await readdir(rootDir)).sort()).toEqual(['alpha-beta', 'alpha-beta-2'])
  })

  it('allocates a -2 directory when a dangling symlink occupies the slug', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    await mkdir(rootDir, { recursive: true })
    await symlink(join(base, 'nowhere'), join(rootDir, 'alpha-beta'), 'dir')

    const result = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    expect(result.dir).toBe(join(resolve(rootDir), 'alpha-beta-2'))
  })

  it('honours an explicit title for the directory and the manifest', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')

    const result = await materializeWorkspace({
      rootDir,
      paths: [alpha, beta],
      title: '  Product Docs  ',
    })

    expect(result.title).toBe('Product Docs')
    expect(result.dir).toBe(join(resolve(rootDir), 'product-docs'))
    expect((await readManifest(result.dir)).title).toBe('Product Docs')
  })

  it('rejects a single folder by default but supports minPaths: 1', async () => {
    const alpha = await makeSource('alpha')
    await expectSelectionError(() => materializeWorkspace({ rootDir, paths: [alpha] }), 'too-few-paths')
    await expect(stat(rootDir)).rejects.toMatchObject({ code: 'ENOENT' })

    const result = await materializeWorkspace({ rootDir, paths: [alpha], minPaths: 1 })
    expect(result.title).toBe('alpha')
    expect(result.links.map(link => link.name)).toEqual(['alpha'])
  })

  it('reports root-unavailable when the root path is a file', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    await writeFile(rootDir, 'not a directory')

    const error = await expectSelectionError(
      () => materializeWorkspace({ rootDir, paths: [alpha, beta] }),
      'root-unavailable',
    )
    expect(error.message).toContain(rootDir)
    expect((await stat(rootDir)).isFile()).toBe(true)
  })

  it.skipIf(process.getuid?.() === 0)(
    'fails with materialize-failed and leaves no residue when the root is not writable',
    async () => {
      const alpha = await makeSource('alpha')
      const beta = await makeSource('beta')
      await mkdir(rootDir, { recursive: true })
      await chmod(rootDir, 0o500)
      try {
        const error = await expectSelectionError(
          () => materializeWorkspace({ rootDir, paths: [alpha, beta] }),
          'materialize-failed',
        )
        expect(error.message).toContain(rootDir)
      } finally {
        await chmod(rootDir, 0o700)
      }
      await expect(readdir(rootDir)).resolves.toEqual([])
    },
  )

  it('removes a partially created directory when a later step fails', async () => {
    // A selected folder named like the manifest makes the manifest write fail
    // (the entry is a symlink to a directory, so writing through it is EISDIR).
    const alpha = await makeSource('alpha')
    const manifestNameSource = await makeSource(MANIFEST_FILE)

    const error = await expectSelectionError(
      () => materializeWorkspace({ rootDir, paths: [alpha, manifestNameSource] }),
      'materialize-failed',
    )
    expect(error.message).toContain(rootDir)
    expect((await stat(rootDir)).isDirectory()).toBe(true)
    await expect(readdir(rootDir)).resolves.toEqual([])
    expect((await stat(alpha)).isDirectory()).toBe(true)
    expect((await stat(manifestNameSource)).isDirectory()).toBe(true)
  })
})

describe('removeWorkspaceDirectory', () => {
  it('removes the combined workspace but keeps the source directories', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const result = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    await removeWorkspaceDirectory(result.dir)

    await expect(stat(result.dir)).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await stat(alpha)).isDirectory()).toBe(true)
    expect((await stat(beta)).isDirectory()).toBe(true)
  })

  it('is a no-op for a directory that is already gone', async () => {
    await expect(removeWorkspaceDirectory(join(rootDir, 'missing'))).resolves.toBeUndefined()
  })
})
