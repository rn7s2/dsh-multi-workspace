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
