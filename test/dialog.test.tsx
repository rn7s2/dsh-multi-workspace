// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MultiFolderDialog } from '../src/client/dialog.js'
import type { DirectoryListing } from '../src/shared/listing.js'

afterEach(cleanup)

/** One two-folder listing used by every case. */
const listing: DirectoryListing = {
  path: '/tmp',
  home: '/tmp',
  crumbs: [{ name: '/', path: '/', hidden: false }],
  entries: [
    { name: 'alpha', path: '/tmp/alpha', hidden: false },
    { name: 'beta', path: '/tmp/beta', hidden: false },
  ],
  truncated: false,
}

/**
 * Render the dialog with deterministic props.
 * @param overrides - prop overrides for one case.
 */
function renderDialog(overrides: Partial<Parameters<typeof MultiFolderDialog>[0]> = {}): {
  onConfirm: ReturnType<typeof vi.fn>
  onCancel: ReturnType<typeof vi.fn>
} {
  const onConfirm = vi.fn(async () => undefined)
  const onCancel = vi.fn()
  render(
    <MultiFolderDialog
      list={async () => listing}
      t={key => key}
      busy={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onConfirm, onCancel }
}

describe('MultiFolderDialog', () => {
  it('renders the listing and keeps the confirm action disabled until one folder is selected', async () => {
    renderDialog()
    expect(await screen.findByText('dialog.title')).toBeTruthy()
    await screen.findByRole('checkbox', { name: 'alpha' })
    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.getByText('beta')).toBeTruthy()
    const confirm = screen.getByRole('button', { name: 'dialog.create' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
  })

  it('hands two selected folders to the create path', async () => {
    const { onConfirm } = renderDialog()
    await screen.findByText('dialog.title')
    await screen.findByRole('checkbox', { name: 'alpha' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'alpha' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'beta' }))
    const create = screen.getByRole('button', { name: 'dialog.create' })
    expect((create as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(create)
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(['/tmp/alpha', '/tmp/beta'])
    })
  })

  it('opens one selected folder directly', async () => {
    const { onConfirm } = renderDialog()
    await screen.findByText('dialog.title')
    await screen.findByRole('checkbox', { name: 'alpha' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'alpha' }))
    const open = screen.getByRole('button', { name: 'dialog.open' })
    fireEvent.click(open)
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(['/tmp/alpha'])
    })
  })

  it('removes a selected folder from the chip list', async () => {
    renderDialog()
    await screen.findByText('dialog.title')
    await screen.findByRole('checkbox', { name: 'alpha' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'alpha' }))
    expect(screen.getByText('dialog.selected')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'dialog.remove' }))
    await waitFor(() => {
      expect(screen.queryByText('dialog.selected')).toBeNull()
    })
  })

  it('reports cancellation', async () => {
    const { onCancel } = renderDialog()
    await screen.findByText('dialog.title')
    fireEvent.click(screen.getByRole('button', { name: 'dialog.cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('MultiFolderDialog append variant', () => {
  it('uses the override copy and the override confirm label', async () => {
    renderDialog({
      overrides: { title: 'Add folders', subtitle: 'links only', confirm: 'Add' },
    })

    expect(await screen.findByText('Add folders')).toBeTruthy()
    expect(screen.getByText('links only')).toBeTruthy()
    await screen.findByRole('checkbox', { name: 'alpha' })
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy()
  })

  it('matches a member through the canonical spelling of a browsed entry', async () => {
    const canonical: DirectoryListing = {
      ...listing,
      entries: [
        { name: 'alpha', path: '/var/tmp/alpha', real: '/tmp/alpha', hidden: false },
        { name: 'beta', path: '/tmp/beta', hidden: false },
      ],
    }
    renderDialog({
      list: async () => canonical,
      overrides: { exclude: ['/tmp/alpha'], confirm: 'Add' },
    })

    const alpha = (await screen.findByRole('checkbox', { name: 'alpha' })) as HTMLInputElement
    expect(alpha.disabled).toBe(true)
    const beta = screen.getByRole('checkbox', { name: 'beta' }) as HTMLInputElement
    expect(beta.disabled).toBe(false)
  })

  it('shows the pending label while submitting and an error without dropping the selection', async () => {
    let release: (() => void) | undefined
    const onConfirm = vi.fn(
      () => new Promise<void>(resolve => {
        release = resolve
      }),
    )
    const view = render(
      <MultiFolderDialog
        list={async () => listing}
        t={key => key}
        busy={false}
        onConfirm={onConfirm}
        onCancel={() => undefined}
        overrides={{ confirm: 'Add', pending: 'Adding…', error: null }}
      />,
    )
    await screen.findByRole('checkbox', { name: 'alpha' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'alpha' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Adding…' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Adding…' }))

    view.rerender(
      <MultiFolderDialog
        list={async () => listing}
        t={key => key}
        busy={false}
        onConfirm={onConfirm}
        onCancel={() => undefined}
        overrides={{ confirm: 'Add', pending: 'Adding…', error: 'folder is outside the workspace' }}
      />,
    )
    expect(await screen.findByText('folder is outside the workspace')).toBeTruthy()
    const alpha = screen.getByRole('checkbox', { name: 'alpha' }) as HTMLInputElement
    expect(alpha.checked).toBe(true)
    release?.()
  })

  it('disables and marks the folders that already belong to the workspace', async () => {
    const { onConfirm } = renderDialog({
      overrides: { exclude: ['/tmp/alpha'], confirm: 'Add' },
    })

    const alpha = (await screen.findByRole('checkbox', { name: 'alpha' })) as HTMLInputElement
    expect(alpha.disabled).toBe(true)
    expect(alpha.checked).toBe(true)
    expect(screen.getByText('dialog.alreadyMember')).toBeTruthy()

    fireEvent.click(screen.getByRole('checkbox', { name: 'beta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(['/tmp/beta']))
  })
})
