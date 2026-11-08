import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMultiWorkspaceService } from '../src/host/index.js'

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
