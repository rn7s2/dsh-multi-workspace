/**
 * One in-flight "manage folders" request, shared between the Workspace menu
 * rows (which raise it) and the frame-wide surface (which renders it). The menu
 * action runs outside React's render phase, so the request lives in a tiny
 * subscription store rather than in component state.
 *
 * @module dsh-multi-workspace/client/requests
 */
import * as React from 'react'
import type { WorkspaceLink } from '../shared/rpc.js'

/** What the surface should show: append folders, or drop members. */
export type FoldersRequestKind = 'add' | 'remove'

/** One captured request; `null` when no surface is open. */
export interface FoldersRequest {
  readonly kind: FoldersRequestKind
  /** Absolute combined-workspace directory. */
  readonly path: string
  /** Durable title at the time the menu opened, shown in the dialog header. */
  readonly title: string
  /** Members at the time the menu opened. */
  readonly members: readonly WorkspaceLink[]
}

/** Current request; module state because the menu action raises it outside React. */
let current: FoldersRequest | null = null

/** Listeners of the frame-wide surface. */
const listeners = new Set<() => void>()

/**
 * Publish a new request; the mounted surface opens on the next render.
 * @param request - the request to show.
 */
export function openFoldersRequest(request: FoldersRequest): void {
  current = request
  for (const listener of listeners) listener()
}

/** Withdraw the request; the mounted surface unmounts. */
export function closeFoldersRequest(): void {
  if (current === null) return
  current = null
  for (const listener of listeners) listener()
}

/**
 * Read the current request reactively.
 * @returns the request, or null when nothing is open.
 */
export function useFoldersRequest(): FoldersRequest | null {
  return React.useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
    () => current,
  )
}
