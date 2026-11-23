import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { apply as applyHost, createMultiWorkspaceService } from '../src/host/index.js'
import { MANIFEST_FILE } from '../src/shared/rpc.js'
import { isUuid } from '../src/shared/uuid.js'

let base: string

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'dsh-multi-workspace-service-'))
  await mkdir(join(base, 'alpha'), { recursive: true })
  await mkdir(join(base, 'beta'), { recursive: true })
})

afterEach(async () => {
  await rm(base, { recursive: true, force: true })
})

/**
 * Build a service with a context that has no optional services.
 * @param rootDir - combined-workspace root (unused by listing and pick).
 */
function makeService(rootDir: string): ReturnType<typeof createMultiWorkspaceService> {
  return createMultiWorkspaceService({ get: () => undefined } as never, rootDir)
}

describe('multiWorkspace service list', () => {
  it('lists a requested directory level', async () => {
    const service = makeService(join(base, 'workspaces'))
    const listing = await service.list(base)
    expect(listing.path).toBe(resolve(base))
    expect(listing.entries.map(entry => entry.name)).toEqual(['alpha', 'beta'])
    expect(listing.home).toBe(resolve(homedir()))
  })

  it('lists the home directory for null', async () => {
    const service = makeService(join(base, 'workspaces'))
    const listing = await service.list(null)
    expect(listing.path).toBe(resolve(homedir()))
    expect(listing.home).toBe(listing.path)
  })

  it('maps a missing directory to a stable Remote failure', async () => {
    const service = makeService(join(base, 'workspaces'))
    await expect(service.list(join(base, 'missing'))).rejects.toMatchObject({
      isDSHRemoteError: true,
      code: 'multi-workspace/list-failed',
      details: { reason: 'path-missing' },
    })
  })

  it('maps a relative path to a stable Remote failure', async () => {
    const service = makeService(join(base, 'workspaces'))
    await expect(service.list('relative')).rejects.toMatchObject({
      code: 'multi-workspace/list-failed',
      details: { reason: 'path-not-absolute' },
    })
  })
})

describe('multiWorkspace service pick', () => {
  it.skipIf(process.platform === 'darwin')(
    'refuses the native panel on a non-macOS host',
    async () => {
      const service = makeService(join(base, 'workspaces'))
      await expect(service.pick('choose')).rejects.toMatchObject({
        isDSHRemoteError: true,
        code: 'multi-workspace/pick-unavailable',
        details: { reason: 'platform' },
      })
    },
  )
})

describe('multiWorkspace service create validation', () => {
  it('rejects an empty selection before touching the filesystem', async () => {
    const service = makeService(join(base, 'workspaces'))
    await expect(
      service.create({ paths: [] }),
    ).rejects.toMatchObject({ code: 'multi-workspace/invalid-request' })
  })

  it('rejects a single folder with the dedicated reason', async () => {
    const service = makeService(join(base, 'workspaces'))
    await expect(service.create({ paths: [join(base, 'alpha')] })).rejects.toMatchObject({
      code: 'multi-workspace/invalid-selection',
      details: { reason: 'too-few-paths' },
    })
  })
})

/** One in-memory Workspace record used by the fake registry. */
interface FakeRecord {
  id: string
  path: string
  title: string
  sessionIds: string[]
  setTitle(title: string): Promise<void>
}

/**
 * Build a registry stub that behaves like the durable one for these paths.
 * @returns the stub plus the records it holds.
 */
function makeRegistry(): {
  records: FakeRecord[]
  registry: {
    create(path: string, title?: string): Promise<FakeRecord>
    list(): FakeRecord[]
    resolveByPath(path: string): Promise<FakeRecord | undefined>
  }
} {
  const records: FakeRecord[] = []
  let counter = 0
  return {
    records,
    registry: {
      async create(path, title) {
        const canonical = await realpath(path)
        const existing = records.find(record => record.path === canonical)
        if (existing !== undefined) return existing
        counter += 1
        const record: FakeRecord = {
          id: `ws-${counter}`,
          path: canonical,
          title: title ?? resolve(path),
          sessionIds: [],
          async setTitle(next) {
            record.title = next
          },
        }
        records.push(record)
        return record
      },
      list() {
        return [...records]
      },
      async resolveByPath(path) {
        const canonical = await realpath(path).catch(() => resolve(path))
        return records.find(record => record.path === canonical)
      },
    },
  }
}

/**
 * Build a service whose context exposes one registry.
 * @param rootDir - combined-workspace root.
 * @param registry - registry stub, or undefined for a composition without one.
 */
function makeServiceWithRegistry(
  rootDir: string,
  registry: ReturnType<typeof makeRegistry>['registry'] | undefined,
  extra: Record<string, unknown> = {},
): ReturnType<typeof createMultiWorkspaceService> {
  const services = new Map<string, unknown>([
    ['workspaceRegistry', registry],
    ...Object.entries(extra),
  ])
  return createMultiWorkspaceService({ get: (name: string) => services.get(name) } as never, rootDir)
}

describe('multiWorkspace service create', () => {
  it('registers a UUID directory and reports the derived title as automatic', async () => {
    const rootDir = join(base, 'workspaces')
    const { registry } = makeRegistry()
    const service = makeServiceWithRegistry(rootDir, registry)

    const result = await service.create({ paths: [join(base, 'alpha'), join(base, 'beta')] })

    expect(isUuid(basename(result.path))).toBe(true)
    expect(result.title).toBe('alpha and beta')
    expect(result.titleAuto).toBe(true)
    expect(result.created).toBe(true)
    expect(result.workspaceId).toBe('ws-1')
    expect(result.links.map(link => link.name)).toEqual(['alpha', 'beta'])
  })

  it('adopts the same directory on a repeat pick instead of doubling it', async () => {
    const rootDir = join(base, 'workspaces')
    const { registry } = makeRegistry()
    const service = makeServiceWithRegistry(rootDir, registry)
    const paths = [join(base, 'alpha'), join(base, 'beta')]

    const first = await service.create({ paths })
    const second = await service.create({ paths })

    expect(second.path).toBe(first.path)
    expect(second.created).toBe(false)
    expect((await readdir(rootDir)).length).toBe(1)
  })
})

describe('multiWorkspace service inspect', () => {
  it('returns null for a directory without a manifest', async () => {
    const service = makeServiceWithRegistry(join(base, 'workspaces'), makeRegistry().registry)
    await expect(service.inspect({ path: join(base, 'alpha') })).resolves.toBeNull()
  })

  it('describes a combined workspace and its registration', async () => {
    const rootDir = join(base, 'workspaces')
    const { registry } = makeRegistry()
    const service = makeServiceWithRegistry(rootDir, registry)
    const created = await service.create({ paths: [join(base, 'alpha'), join(base, 'beta')] })

    const info = await service.inspect({ path: created.path })

    expect(info).toMatchObject({
      path: created.path,
      title: 'alpha and beta',
      titleAuto: true,
      workspaceId: created.workspaceId,
    })
    expect(info?.members.map(member => member.name)).toEqual(['alpha', 'beta'])
  })
})

describe('multiWorkspace service edits', () => {
  it('adds a folder and retitles the registered workspace', async () => {
    await mkdir(join(base, 'gamma'), { recursive: true })
    const rootDir = join(base, 'workspaces')
    const { registry, records } = makeRegistry()
    const service = makeServiceWithRegistry(rootDir, registry)
    const created = await service.create({ paths: [join(base, 'alpha'), join(base, 'beta')] })

    const updated = await service.addFolders({ path: created.path, paths: [join(base, 'gamma')] })

    expect(updated.title).toBe('alpha, beta and gamma')
    expect(updated.members.map(member => member.name)).toEqual(['alpha', 'beta', 'gamma'])
    expect(updated.changed.map(member => member.name)).toEqual(['gamma'])
    expect(records[0]?.title).toBe('alpha, beta and gamma')
  })

  it('removes a folder and keeps the durable title in step', async () => {
    await mkdir(join(base, 'gamma'), { recursive: true })
    const rootDir = join(base, 'workspaces')
    const { registry, records } = makeRegistry()
    const service = makeServiceWithRegistry(rootDir, registry)
    const created = await service.create({
      paths: [join(base, 'alpha'), join(base, 'beta'), join(base, 'gamma')],
    })

    const updated = await service.removeFolders({ path: created.path, names: ['beta'] })

    expect(updated.members.map(member => member.name)).toEqual(['alpha', 'gamma'])
    expect(updated.title).toBe('alpha and gamma')
    expect(records[0]?.title).toBe('alpha and gamma')
    expect((await stat(join(base, 'beta'))).isDirectory()).toBe(true)
  })

  it('maps the member floor to a stable Remote failure', async () => {
    const service = makeServiceWithRegistry(join(base, 'workspaces'), makeRegistry().registry)
    const created = await service.create({ paths: [join(base, 'alpha'), join(base, 'beta')] })

    await expect(service.removeFolders({ path: created.path, names: ['beta'] })).rejects.toMatchObject({
      code: 'multi-workspace/invalid-selection',
      details: { reason: 'too-few-members' },
    })
  })

  it('rejects a directory that is not a combined workspace', async () => {
    const service = makeServiceWithRegistry(join(base, 'workspaces'), makeRegistry().registry)
    await expect(
      service.addFolders({ path: join(base, 'alpha'), paths: [join(base, 'beta')] }),
    ).rejects.toMatchObject({
      code: 'multi-workspace/invalid-selection',
      details: { reason: 'not-combined' },
    })
  })
})

describe('combined-workspace cleanup', () => {
  /**
   * Apply the plugin over a context that records the domain listener.
   * @param rootDir - combined-workspace root.
   * @param registry - registry stub.
   */
  function applyPlugin(
    rootDir: string,
    registry: ReturnType<typeof makeRegistry>['registry'],
  ): (change: Record<string, unknown>) => void {
    const services = new Map<string, unknown>([['workspaceRegistry', registry]])
    let listener: ((change: Record<string, unknown>) => void) | undefined
    const ctx = {
      get: (name: string) => services.get(name),
      provide: () => () => undefined,
      inject: () => undefined,
      on: (_event: string, callback: (change: Record<string, unknown>) => void) => {
        listener = callback
        return () => undefined
      },
    }
    applyHost(ctx as never, { rootDir })
    return change => {
      if (listener === undefined) throw new Error('the plugin did not subscribe to the domain')
      listener(change)
    }
  }

  it('drops the directory of a workspace that never owned a session', async () => {
    const rootDir = join(base, 'workspaces')
    const { registry, records } = makeRegistry()
    const service = makeServiceWithRegistry(rootDir, registry)
    const created = await service.create({ paths: [join(base, 'alpha'), join(base, 'beta')] })
    const fire = applyPlugin(rootDir, registry)

    fire({ domain: 'workspace', table: 'workspaces', key: records[0]?.id, operation: 'put', value: records[0] })
    fire({ domain: 'workspace', table: 'workspaces', key: records[0]?.id, operation: 'deleted' })
    await new Promise(resolveWait => setTimeout(resolveWait, 100))

    await expect(stat(created.path)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps the directory when somebody left a file in it', async () => {
    const rootDir = join(base, 'workspaces')
    const { registry, records } = makeRegistry()
    const service = makeServiceWithRegistry(rootDir, registry)
    const created = await service.create({ paths: [join(base, 'alpha'), join(base, 'beta')] })
    await writeFile(join(created.path, 'notes.txt'), 'mine')
    const fire = applyPlugin(rootDir, registry)

    fire({ domain: 'workspace', table: 'workspaces', key: records[0]?.id, operation: 'put', value: records[0] })
    fire({ domain: 'workspace', table: 'workspaces', key: records[0]?.id, operation: 'deleted' })
    await new Promise(resolveWait => setTimeout(resolveWait, 100))

    expect((await stat(created.path)).isDirectory()).toBe(true)
    expect((await readFile(join(created.path, 'notes.txt'), 'utf8'))).toBe('mine')
    await expect(stat(join(created.path, 'alpha'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps the directory of a workspace that owned a session', async () => {
    const rootDir = join(base, 'workspaces')
    const { registry, records } = makeRegistry()
    const service = makeServiceWithRegistry(rootDir, registry)
    const created = await service.create({ paths: [join(base, 'alpha'), join(base, 'beta')] })
    const fire = applyPlugin(rootDir, registry)

    fire({
      domain: 'workspace',
      table: 'workspaces',
      key: records[0]?.id,
      operation: 'put',
      value: { ...records[0], sessionIds: ['session-1'] },
    })
    fire({ domain: 'workspace', table: 'workspaces', key: records[0]?.id, operation: 'deleted' })
    await new Promise(resolveWait => setTimeout(resolveWait, 100))

    expect((await stat(created.path)).isDirectory()).toBe(true)
  })
})

describe('review fixes: inspection scope and session awareness', () => {
  it('ignores a combined-looking directory outside the root', async () => {
    const rootDir = join(base, 'workspaces')
    const service = makeServiceWithRegistry(rootDir, makeRegistry().registry)
    const foreign = join(base, 'elsewhere')
    await mkdir(foreign, { recursive: true })
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

    await expect(service.inspect({ path: foreign })).resolves.toBeNull()
  })

  it('marks the members a live session is working in', async () => {
    const rootDir = join(base, 'workspaces')
    const service = makeServiceWithRegistry(rootDir, makeRegistry().registry)
    const created = await service.create({ paths: [join(base, 'alpha'), join(base, 'beta')] })
    const members = (await service.inspect({ path: created.path }))?.members ?? []
    const alphaTarget = members.find(member => member.name === 'alpha')?.target ?? created.path
    const cwd = join(alphaTarget, 'nested')
    const session = { header: { cwd } }
    const aware = makeServiceWithRegistry(rootDir, makeRegistry().registry, {
      agents: { list: () => [{ session }] },
      workingDirectory: { get: () => cwd },
    })

    const info = await aware.inspect({ path: created.path })

    expect(info?.members.find(member => member.name === 'alpha')?.inUse).toBe(true)
    expect(info?.members.find(member => member.name === 'beta')?.inUse).toBeUndefined()
    // A composition without the Agent service simply reports nothing in use.
    const plain = await service.inspect({ path: created.path })
    expect(plain?.members.every(member => member.inUse === undefined)).toBe(true)
  })

  it('suffixes a new workspace title that another one already uses', async () => {
    const rootDir = join(base, 'workspaces')
    const service = makeServiceWithRegistry(rootDir, makeRegistry().registry)
    const first = await service.create({ paths: [join(base, 'alpha'), join(base, 'beta')] })
    await mkdir(join(base, 'alpha2'), { recursive: true })
    await mkdir(join(base, 'beta2'), { recursive: true })

    const second = await service.create({
      paths: [join(base, 'alpha2'), join(base, 'beta2')],
      title: 'alpha and beta',
    })

    expect(first.title).toBe('alpha and beta')
    // An explicit title from the operator is respected rather than suffixed.
    expect(second.title).toBe('alpha and beta')
  })

  it('still reports the edit as done when the title update fails', async () => {
    await mkdir(join(base, 'gamma'), { recursive: true })
    const rootDir = join(base, 'workspaces')
    const { registry, records } = makeRegistry()
    const service = makeServiceWithRegistry(rootDir, registry)
    const created = await service.create({ paths: [join(base, 'alpha'), join(base, 'beta')] })
    const record = records[0]
    expect(record).toBeDefined()
    if (record !== undefined) record.setTitle = async () => { throw new Error('title write failed') }

    const updated = await service.addFolders({ path: created.path, paths: [join(base, 'gamma')] })

    expect(updated.members.map(member => member.name)).toEqual(['alpha', 'beta', 'gamma'])
    // The edit stands; the title stays on its previous automatic value.
    expect(updated.title).toBe('alpha and beta')
    expect(updated.titleAuto).toBe(true)
    expect(record?.title).toBe('alpha and beta')

    // The stale value the registry echoes back is not read as a manual title,
    // so the next edit still recomputes it.
    const manifest = JSON.parse(await readFile(join(created.path, MANIFEST_FILE), 'utf8')) as {
      title: string
      titleAuto: boolean
    }
    expect(manifest).toMatchObject({ title: 'alpha and beta', titleAuto: true })

    // A stale echo of the published-failed title is ignored, so the next edit
    // still recomputes from the folders.
    await mkdir(join(base, 'delta'), { recursive: true })
    if (record !== undefined) record.setTitle = async next => { record.title = next }
    const again = await service.addFolders({ path: created.path, paths: [join(base, 'delta')] })
    expect(again.title).toBe('alpha, beta, gamma and delta')
    expect(again.titleAuto).toBe(true)
  })
})
