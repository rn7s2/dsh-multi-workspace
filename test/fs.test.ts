import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, readlink, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SelectionError } from '../src/host/core.js'
import type { SelectionErrorCode } from '../src/host/core.js'
import {
  addFolders,
  dissolveWorkspaceDirectory,
  materializeWorkspace,
  readCombinedWorkspace,
  readCombinedWorkspaceWithin,
  removeFolders,
  resolveSources,
  syncWorkspaceTitle,
} from '../src/host/fs.js'
import { HARD_MAX_PATHS } from '../src/shared/naming.js'
import { MANIFEST_FILE } from '../src/shared/rpc.js'
import { isUuid } from '../src/shared/uuid.js'

/** Parsed shape of the hidden manifest written by the Host. */
interface Manifest {
  version: number
  kind: string
  id: string
  createdAt: string
  title: string
  titleAuto: boolean
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
  it('creates a missing root, a UUID directory, symlinks, and a v2 manifest', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const expectedSources = [await realpath(alpha), await realpath(beta)]

    const result = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    expect(isUuid(basename(result.dir))).toBe(true)
    expect(result.dir).toBe(join(resolve(rootDir), basename(result.dir)))
    expect(result.id).toBe(basename(result.dir))
    expect(result.title).toBe('alpha and beta')
    expect(result.titleAuto).toBe(true)
    expect(result.adopted).toBe(false)
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
    expect(manifest.version).toBe(2)
    expect(manifest.kind).toBe('dsh-multi-workspace')
    expect(manifest.id).toBe(result.id)
    expect(manifest.title).toBe('alpha and beta')
    expect(manifest.titleAuto).toBe(true)
    expect(manifest.links).toEqual(result.links)
    expect(new Date(manifest.createdAt).toISOString()).toBe(manifest.createdAt)
  })

  it('names each new directory after a time-ordered UUID, never after the folders', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const first = await materializeWorkspace({ rootDir, paths: [alpha, beta] })
    const otherRoot = join(base, 'other-root')
    const second = await materializeWorkspace({ rootDir: otherRoot, paths: [alpha, beta] })

    expect(first.dir).not.toBe(second.dir)
    expect(isUuid(basename(first.dir))).toBe(true)
    expect(isUuid(basename(second.dir))).toBe(true)
    // Version 7 keeps creation order in the lexicographic order of the names.
    expect(basename(first.dir) < basename(second.dir)).toBe(true)
    expect(basename(first.dir)).not.toContain('alpha')
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

  it('never uses the manifest name as a member entry', async () => {
    const alpha = await makeSource('alpha')
    const decoy = await makeSource(MANIFEST_FILE)

    const result = await materializeWorkspace({ rootDir, paths: [alpha, decoy] })

    expect(result.links.map(link => link.name)).toEqual(['alpha', `${MANIFEST_FILE}-2`])
    expect((await readManifest(result.dir)).links).toEqual(result.links)
  })

  it('keeps an explicit title and marks it manual', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')

    const result = await materializeWorkspace({
      rootDir,
      paths: [alpha, beta],
      title: '  Product Docs  ',
    })

    expect(result.title).toBe('Product Docs')
    expect(result.titleAuto).toBe(false)
    expect(isUuid(basename(result.dir))).toBe(true)
    expect(await readManifest(result.dir)).toMatchObject({ title: 'Product Docs', titleAuto: false })
  })

  it('adopts an unowned directory holding the same folders instead of doubling it', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const first = await materializeWorkspace({ rootDir, paths: [alpha, beta] })
    const before = await readManifest(first.dir)

    const again = await materializeWorkspace({ rootDir, paths: [beta, alpha], })

    expect(again.dir).toBe(first.dir)
    expect(again.adopted).toBe(true)
    expect(again.id).toBe(first.id)
    expect((await readdir(rootDir)).length).toBe(1)
    expect((await readManifest(again.dir)).createdAt).toBe(before.createdAt)
  })

  it('repairs a missing link when it adopts a directory', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const first = await materializeWorkspace({ rootDir, paths: [alpha, beta] })
    await rm(join(first.dir, 'beta'))

    const again = await materializeWorkspace({ rootDir, paths: [alpha, beta], })

    expect(again.dir).toBe(first.dir)
    expect((await lstat(join(again.dir, 'beta'))).isSymbolicLink()).toBe(true)
  })

  it('creates a second directory when the member set differs', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const gamma = await makeSource('gamma')
    const first = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    const second = await materializeWorkspace({ rootDir, paths: [alpha, gamma] })

    expect(second.dir).not.toBe(first.dir)
    expect(second.adopted).toBe(false)
    expect((await readdir(rootDir)).length).toBe(2)
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
})

describe('readCombinedWorkspace', () => {
  it('returns null for a directory without a manifest', async () => {
    const plain = await makeSource('plain')
    await expect(readCombinedWorkspace(plain)).resolves.toBeNull()
  })

  it('returns null for an unreadable or foreign manifest', async () => {
    const dir = await makeSource('foreign')
    await writeFile(join(dir, MANIFEST_FILE), '{"kind":"other"}')
    await expect(readCombinedWorkspace(dir)).resolves.toBeNull()
  })

  it('reads a pre-UUID manifest and treats its title as derived', async () => {
    const dir = await makeSource('legacy')
    await writeFile(
      join(dir, MANIFEST_FILE),
      JSON.stringify({
        version: 1,
        kind: 'dsh-multi-workspace',
        createdAt: '2026-10-26T00:00:00.000Z',
        title: 'alpha and beta',
        links: [
          { name: 'alpha', target: '/src/alpha' },
          { name: 'beta', target: '/src/beta' },
        ],
      }),
    )

    const workspace = await readCombinedWorkspace(dir)

    expect(workspace).toMatchObject({
      id: 'legacy',
      title: 'alpha and beta',
      titleAuto: true,
      createdAt: '2026-10-26T00:00:00.000Z',
    })
  })
})

describe('addFolders', () => {
  it('links the new folders, keeps manifest order, and recomputes the title', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const gamma = await makeSource('gamma')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    const { workspace, changed } = await addFolders(created.dir, [gamma], { rootDir })

    expect(changed).toEqual([{ name: 'gamma', target: await realpath(gamma) }])
    expect(workspace.links.map(link => link.name)).toEqual(['alpha', 'beta', 'gamma'])
    expect(workspace.title).toBe('alpha, beta and gamma')
    expect(workspace.titleAuto).toBe(true)
    expect((await lstat(join(created.dir, 'gamma'))).isSymbolicLink()).toBe(true)
    expect(await readManifest(created.dir)).toMatchObject({
      title: 'alpha, beta and gamma',
      links: workspace.links,
    })
  })

  it('suffixes a name that the workspace already uses', async () => {
    const first = await makeSource('first', 'docs')
    const second = await makeSource('second', 'docs')
    const third = await makeSource('third', 'docs')
    const created = await materializeWorkspace({ rootDir, paths: [first, second] })

    const { changed } = await addFolders(created.dir, [third], { rootDir })

    expect(changed).toEqual([{ name: 'docs-3', target: await realpath(third) }])
  })

  it('keeps a manual title through a membership change', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const gamma = await makeSource('gamma')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta], title: 'Product Docs' })

    const { workspace } = await addFolders(created.dir, [gamma], { rootDir })

    expect(workspace.title).toBe('Product Docs')
    expect(workspace.titleAuto).toBe(false)
    expect((await readManifest(created.dir)).titleAuto).toBe(false)
  })

  it('suffixes an automatic title another workspace already uses', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const gamma = await makeSource('gamma')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    const { workspace } = await addFolders(created.dir, [gamma], {
      rootDir,
      takenTitles: ['alpha, beta and gamma'],
    })

    expect(workspace.title).toBe('alpha, beta and gamma (2)')
  })

  it('rejects a folder that is already a member', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    await expectSelectionError(() => addFolders(created.dir, [alpha], { rootDir }), 'duplicate-path')
  })

  it('rejects an empty addition', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    await expectSelectionError(() => addFolders(created.dir, [], { rootDir }), 'empty-selection')
  })

  it('rejects a directory outside the workspace root', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta] })
    const plain = await makeSource('plain')

    await expectSelectionError(() => addFolders(plain, [alpha], { rootDir }), 'not-combined')
  })

  it('rejects a directory inside the root that holds no manifest', async () => {
    const alpha = await makeSource('alpha')
    await mkdir(join(rootDir, 'stray'), { recursive: true })

    await expectSelectionError(() => addFolders(join(rootDir, 'stray'), [alpha], { rootDir }), 'not-combined')
  })

  it('rolls back the links it created when a later link fails', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const gamma = await makeSource('gamma')
    const delta = await makeSource('delta')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta] })
    const manifestBefore = await readManifest(created.dir)
    // A real directory occupies the name the second new link would take.
    await mkdir(join(created.dir, 'delta'))

    await expectSelectionError(() => addFolders(created.dir, [gamma, delta], { rootDir }), 'materialize-failed')

    await expect(lstat(join(created.dir, 'gamma'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await readManifest(created.dir)).links).toEqual(manifestBefore.links)
    expect((await stat(join(created.dir, 'delta'))).isDirectory()).toBe(true)
  })
})

describe('removeFolders', () => {
  it('drops the link and the manifest entry but never the folder', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const gamma = await makeSource('gamma')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta, gamma] })

    const { workspace, changed } = await removeFolders(created.dir, ['beta'], { rootDir })

    expect(changed.map(link => link.name)).toEqual(['beta'])
    expect(workspace.links.map(link => link.name)).toEqual(['alpha', 'gamma'])
    expect(workspace.title).toBe('alpha and gamma')
    await expect(lstat(join(created.dir, 'beta'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await stat(beta)).isDirectory()).toBe(true)
    expect((await readManifest(created.dir)).links.map(link => link.name)).toEqual(['alpha', 'gamma'])
  })

  it('refuses to leave fewer than two members', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    await expectSelectionError(() => removeFolders(created.dir, ['beta'], { rootDir }), 'too-few-members')
    expect((await readManifest(created.dir)).links.length).toBe(2)
  })

  it('rejects an unknown member', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const gamma = await makeSource('gamma')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta, gamma] })

    await expectSelectionError(() => removeFolders(created.dir, ['delta'], { rootDir }), 'member-unknown')
  })

  it('refuses an entry that is not a link created by this plugin', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const gamma = await makeSource('gamma')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta, gamma] })
    await rm(join(created.dir, 'beta'))
    await mkdir(join(created.dir, 'beta'))

    await expectSelectionError(() => removeFolders(created.dir, ['beta'], { rootDir }), 'materialize-failed')
    expect((await stat(join(created.dir, 'beta'))).isDirectory()).toBe(true)
  })

  it('keeps a manual title through a removal', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const gamma = await makeSource('gamma')
    const created = await materializeWorkspace({
      rootDir,
      paths: [alpha, beta, gamma],
      title: 'Product Docs',
    })

    const { workspace } = await removeFolders(created.dir, ['beta'], { rootDir })

    expect(workspace.title).toBe('Product Docs')
    expect(workspace.titleAuto).toBe(false)
  })
})

describe('dissolveWorkspaceDirectory', () => {
  it('removes the links, the manifest and the directory but keeps the folders', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const result = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    await expect(dissolveWorkspaceDirectory(result.dir)).resolves.toBe(true)

    await expect(stat(result.dir)).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await stat(alpha)).isDirectory()).toBe(true)
    expect((await stat(beta)).isDirectory()).toBe(true)
  })

  it('keeps a file somebody put in the directory, and the directory with it', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const result = await materializeWorkspace({ rootDir, paths: [alpha, beta] })
    await writeFile(join(result.dir, 'notes.txt'), 'mine')

    await expect(dissolveWorkspaceDirectory(result.dir)).resolves.toBe(false)

    expect(await readFile(join(result.dir, 'notes.txt'), 'utf8')).toBe('mine')
    await expect(lstat(join(result.dir, 'alpha'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(lstat(join(result.dir, MANIFEST_FILE))).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await stat(alpha)).isDirectory()).toBe(true)
  })

  it('keeps an entry that is no longer a link, and still drops the rest', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const result = await materializeWorkspace({ rootDir, paths: [alpha, beta] })
    await rm(join(result.dir, 'beta'))
    await mkdir(join(result.dir, 'beta'))
    await writeFile(join(result.dir, 'beta', 'keep.txt'), 'keep')

    await expect(dissolveWorkspaceDirectory(result.dir)).resolves.toBe(false)

    expect(await readFile(join(result.dir, 'beta', 'keep.txt'), 'utf8')).toBe('keep')
  })

  it('reports false for a directory that is not a combined workspace', async () => {
    const plain = await makeSource('plain')
    await expect(dissolveWorkspaceDirectory(plain)).resolves.toBe(false)
    expect((await stat(plain)).isDirectory()).toBe(true)
  })
})

describe('review fixes', () => {
  it('applies the collision suffix when a new workspace is created', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')

    const result = await materializeWorkspace({
      rootDir,
      paths: [alpha, beta],
      takenTitles: ['alpha and beta'],
    })

    expect(result.title).toBe('alpha and beta (2)')
    expect(result.titleAuto).toBe(true)
    expect((await readManifest(result.dir)).title).toBe('alpha and beta (2)')
  })

  it('keeps retitling a title that carries a collision suffix', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const gamma = await makeSource('gamma')
    const created = await materializeWorkspace({
      rootDir,
      paths: [alpha, beta],
      takenTitles: ['alpha and beta'],
    })
    expect(created.title).toBe('alpha and beta (2)')

    const { workspace } = await addFolders(created.dir, [gamma], { rootDir })

    expect(workspace.title).toBe('alpha, beta and gamma')
    expect(workspace.titleAuto).toBe(true)
  })

  it('removes a member whose link was deleted by hand', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const gamma = await makeSource('gamma')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta, gamma] })
    await rm(join(created.dir, 'beta'))

    const { workspace, changed } = await removeFolders(created.dir, ['beta'], { rootDir })

    expect(changed.map(link => link.name)).toEqual(['beta'])
    expect(workspace.links.map(link => link.name)).toEqual(['alpha', 'gamma'])
    expect((await stat(beta)).isDirectory()).toBe(true)
  })

  it('keeps both members when two edits overlap', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const gamma = await makeSource('gamma')
    const delta = await makeSource('delta')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    await Promise.all([
      addFolders(created.dir, [gamma], { rootDir }),
      addFolders(created.dir, [delta], { rootDir }),
    ])

    const workspace = await readCombinedWorkspace(created.dir)
    expect(workspace?.links.map(link => link.name).sort()).toEqual(['alpha', 'beta', 'delta', 'gamma'])
  })

  it('does not let a concurrent title sync drop a member the edit just added', async () => {
    const alpha = await makeSource('alpha')
    const beta = await makeSource('beta')
    const gamma = await makeSource('gamma')
    const created = await materializeWorkspace({ rootDir, paths: [alpha, beta] })

    await Promise.all([
      addFolders(created.dir, [gamma], { rootDir }),
      syncWorkspaceTitle(created.dir, 'alpha and beta'),
    ])

    const workspace = await readCombinedWorkspace(created.dir)
    expect(workspace?.links.map(link => link.name)).toContain('gamma')
  })

  it('ignores a directory outside the root, whatever its manifest says', async () => {
    const foreign = await makeSource('foreign')
    await writeFile(
      join(foreign, MANIFEST_FILE),
      JSON.stringify({
        version: 2,
        kind: 'dsh-multi-workspace',
        id: 'x',
        createdAt: '2026-01-01T00:00:00.000Z',
        title: 'x and y',
        titleAuto: true,
        links: [{ name: 'x', target: foreign }],
      }),
    )

    await expect(readCombinedWorkspaceWithin(foreign, rootDir)).resolves.toBeNull()
    await expect(readCombinedWorkspace(foreign)).resolves.not.toBeNull()
  })
})
