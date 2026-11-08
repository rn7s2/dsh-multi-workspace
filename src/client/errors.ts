/**
 * Client-side Remote failure with its stable code, so the flow can distinguish
 * "this host cannot show the native panel" from a genuine interaction failure.
 *
 * @module dsh-multi-workspace/client/errors
 */

/** Stable Remote failure code returned when the native panel is unusable. */
export const PICK_UNAVAILABLE_CODE = 'multi-workspace/pick-unavailable'

/** A Remote call that answered with a business failure. */
export class RemoteCallError extends Error {
  /** Stable Host code, e.g. `multi-workspace/pick-unavailable`. */
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'RemoteCallError'
    this.code = code
  }
}

/**
 * Whether the error means the native panel is unavailable on this host.
 * @param error - rejection from the pick Remote call.
 * @returns true when the Client should open its in-app browser.
 */
export function isPickUnavailable(error: unknown): boolean {
  return error instanceof RemoteCallError && error.code === PICK_UNAVAILABLE_CODE
}

/**
 * Human-readable message of an unknown rejection.
 * @param error - unknown rejection.
 * @returns the error message or its string form.
 */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
