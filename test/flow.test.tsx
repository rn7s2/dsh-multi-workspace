// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PICK_UNAVAILABLE_CODE, RemoteCallError } from '../src/client/errors.js'
import { MultiWorkspaceFlow } from '../src/client/flow.js'
import type { DirectoryListing } from '../src/shared/listing.js'

afterEach(cleanup)

/** One two-folder listing used by the fallback cases. */
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
 * Render the flow with deterministic Remote doubles.
 * @param pick - native-panel double.
 * @param createCombined - create double.
 */
function renderFlow(
  pick: (message: string) => Promise<string[] | null>,
  createCombined: (paths: readonly string[]) => Promise<{ path: string }>,
): {
  onPicked: ReturnType<typeof vi.fn>
  onCancel: ReturnType<typeof vi.fn>
  onError: ReturnType<typeof vi.fn>
} {
  const onPicked = vi.fn()
  const onCancel = vi.fn()
  const onError = vi.fn()
  render(
    <MultiWorkspaceFlow
      open={true}
      busy={false}
      message="choose"
      t={key => key}
      pick={pick}
      list={async () => listing}
      createCombined={createCombined}
      onPicked={onPicked}
      onCancel={onCancel}
      onError={onError}
    />,
  )
  return { onPicked, onCancel, onError }
}

describe('MultiWorkspaceFlow', () => {
  it('falls back to the in-app browser when the native panel is unavailable', async () => {
    const pick = async (): Promise<string[] | null> => {
      throw new RemoteCallError(PICK_UNAVAILABLE_CODE, 'no local display')
    }
    const createCombined = vi.fn(async (_paths: readonly string[]) => ({ path: '/tmp/combined' }))
    const { onPicked } = renderFlow(pick, createCombined)
    expect(await screen.findByText('dialog.title')).toBeTruthy()
    await screen.findByRole('checkbox', { name: 'alpha' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'alpha' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'beta' }))
    fireEvent.click(screen.getByRole('button', { name: 'dialog.create' }))
    await waitFor(() => {
      expect(createCombined).toHaveBeenCalledWith(['/tmp/alpha', '/tmp/beta'])
      expect(onPicked).toHaveBeenCalledWith('/tmp/combined')
    })
  })

  it('opens one folder directly from the in-app browser', async () => {
    const pick = async (): Promise<string[] | null> => {
      throw new RemoteCallError(PICK_UNAVAILABLE_CODE, 'no local display')
    }
    const createCombined = vi.fn(async (_paths: readonly string[]) => ({ path: '/tmp/combined' }))
    const { onPicked } = renderFlow(pick, createCombined)
    await screen.findByText('dialog.title')
    await screen.findByRole('checkbox', { name: 'alpha' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'alpha' }))
    fireEvent.click(screen.getByRole('button', { name: 'dialog.open' }))
    await waitFor(() => {
      expect(onPicked).toHaveBeenCalledWith('/tmp/alpha')
    })
    expect(createCombined).not.toHaveBeenCalled()
  })

  it('uses the native selection without opening the dialog', async () => {
    const pick = vi.fn(async () => ['/tmp/alpha', '/tmp/beta'])
    const createCombined = vi.fn(async (_paths: readonly string[]) => ({ path: '/tmp/combined' }))
    const { onPicked } = renderFlow(pick, createCombined)
    await waitFor(() => {
      expect(onPicked).toHaveBeenCalledWith('/tmp/combined')
    })
    expect(screen.queryByText('dialog.title')).toBeNull()
    expect(createCombined).toHaveBeenCalledWith(['/tmp/alpha', '/tmp/beta'])
  })

  it('reports a generic native-panel failure to the owner', async () => {
    const pick = async (): Promise<string[] | null> => {
      throw new Error('osascript exploded')
    }
    const { onError } = renderFlow(pick, async () => ({ path: '/tmp/combined' }))
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('osascript exploded')
    })
  })

  it('cancels from the in-app browser', async () => {
    const pick = async (): Promise<string[] | null> => {
      throw new RemoteCallError(PICK_UNAVAILABLE_CODE, 'no local display')
    }
    const { onCancel } = renderFlow(pick, async () => ({ path: '/tmp/combined' }))
    await screen.findByText('dialog.title')
    fireEvent.click(screen.getByRole('button', { name: 'dialog.cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
