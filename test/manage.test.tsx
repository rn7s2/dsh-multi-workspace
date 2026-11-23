// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FoldersSurface } from '../src/client/manage.js'
import { RemoteCallError } from '../src/client/errors.js'
import { closeFoldersRequest, openFoldersRequest } from '../src/client/requests.js'
import type { DirectoryListing } from '../src/shared/listing.js'

afterEach(() => {
  closeFoldersRequest()
  cleanup()
})

/** One two-folder listing used by the cases. */
const listing: DirectoryListing = {
  path: '/tmp',
  home: '/tmp',
  crumbs: [{ name: '/', path: '/', hidden: false }],
  entries: [
    { name: 'alpha', path: '/tmp/alpha', hidden: false },
    { name: 'beta', path: '/tmp/beta', hidden: false },
    { name: 'gamma', path: '/tmp/gamma', hidden: false },
  ],
  truncated: false,
}

/** Members of the workspace under test. */
const members = [
  { name: 'alpha', target: '/tmp/alpha' },
  { name: 'beta', target: '/tmp/beta' },
]

/**
 * Render the surface with deterministic injections.
 * @param overrides - injection overrides for one case.
 */
function renderSurface(overrides: Partial<Parameters<typeof FoldersSurface>[0]> = {}): void {
  render(
    <FoldersSurface
      t={(key, params) => (params === undefined ? key : `${key}:${Object.values(params).join(',')}`)}
      message="pick folders"
      pick={async () => {
        throw new RemoteCallError('multi-workspace/pick-unavailable', 'no panel here')
      }}
      list={async () => listing}
      addFolders={async () => ({ title: 'alpha and beta' })}
      removeFolders={async () => ({ title: 'alpha' })}
      {...overrides}
    />,
  )
}

describe('FoldersSurface append flow', () => {
  it('falls back to the browser when no native panel exists', async () => {
    openFoldersRequest({ kind: 'add', path: '/tmp/ws', title: 'alpha and beta', members })

    renderSurface()

    expect(await screen.findByRole('button', { name: 'manage.add.confirm' })).toBeTruthy()
    // The member folders are already greyed out in the picker.
    const alpha = (await screen.findByRole('checkbox', { name: 'alpha' })) as HTMLInputElement
    expect(alpha.disabled).toBe(true)
  })

  it('keeps the picked folders and shows the failure when the add is rejected', async () => {
    openFoldersRequest({ kind: 'add', path: '/tmp/ws', title: 'alpha and beta', members })
    let attempt = 0
    renderSurface({
      addFolders: async () => {
        attempt += 1
        throw new Error('folder is outside the workspace')
      },
    })

    fireEvent.click(await screen.findByRole('checkbox', { name: 'gamma' }))
    fireEvent.click(screen.getByRole('button', { name: 'manage.add.confirm' }))

    expect(await screen.findByText('folder is outside the workspace')).toBeTruthy()
    const gamma = screen.getByRole('checkbox', { name: 'gamma' }) as HTMLInputElement
    expect(gamma.checked).toBe(true)

    // The same surface can retry without re-picking anything.
    fireEvent.click(screen.getByRole('button', { name: 'manage.add.confirm' }))
    await waitFor(() => expect(attempt).toBe(2))
  })

  it('closes once the add succeeds', async () => {
    openFoldersRequest({ kind: 'add', path: '/tmp/ws', title: 'alpha and beta', members })
    const addFolders = vi.fn(async () => ({ title: 'alpha, beta and gamma' }))
    renderSurface({ addFolders })

    fireEvent.click(await screen.findByRole('checkbox', { name: 'gamma' }))
    fireEvent.click(screen.getByRole('button', { name: 'manage.add.confirm' }))

    await waitFor(() => expect(addFolders).toHaveBeenCalledWith('/tmp/ws', ['/tmp/gamma']))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('offers another attempt when the native panel itself fails', async () => {
    openFoldersRequest({ kind: 'add', path: '/tmp/ws', title: 'alpha and beta', members })
    renderSurface({
      pick: async () => {
        throw new Error('osascript exploded')
      },
    })

    expect(await screen.findByText('osascript exploded')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'manage.retry' })).toBeTruthy()
  })
})

describe('FoldersSurface removal flow', () => {
  const three = [...members, { name: 'gamma', target: '/tmp/gamma' }]

  it('warns about a running session in a folder that is being removed', async () => {
    openFoldersRequest({
      kind: 'remove',
      path: '/tmp/ws',
      title: 'alpha and beta and gamma',
      members: three.map(member => (member.name === 'gamma' ? { ...member, inUse: true } : member)),
    })
    renderSurface()

    fireEvent.click(await screen.findByRole('checkbox', { name: 'gamma' }))

    expect(await screen.findByText(/manage\.remove\.inUseWarning/)).toBeTruthy()
  })

  it('refuses to remove down to a single folder', async () => {
    openFoldersRequest({ kind: 'remove', path: '/tmp/ws', title: 'alpha and beta', members })
    renderSurface()

    fireEvent.click(await screen.findByRole('checkbox', { name: 'beta' }))

    expect(await screen.findByText(/manage\.remove\.minimum/)).toBeTruthy()
    const confirm = screen.getByRole('button', { name: 'manage.remove.confirm' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
  })

  it('hands the chosen members to the Host and closes', async () => {
    openFoldersRequest({ kind: 'remove', path: '/tmp/ws', title: 'alpha and beta and gamma', members: three })
    const removeFolders = vi.fn(async () => ({ title: 'alpha and beta' }))
    renderSurface({ removeFolders })

    fireEvent.click(await screen.findByRole('checkbox', { name: 'gamma' }))
    fireEvent.click(screen.getByRole('button', { name: 'manage.remove.confirm' }))

    await waitFor(() => expect(removeFolders).toHaveBeenCalledWith('/tmp/ws', ['gamma']))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
