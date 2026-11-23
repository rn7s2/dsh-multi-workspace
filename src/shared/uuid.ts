/**
 * Time-ordered (version 7) UUIDs used as the durable identity of a combined
 * workspace directory. Version 7 puts a 48-bit Unix epoch millisecond stamp in
 * the leading bytes, so lexicographic order equals creation order: `ls` and any
 * sort over the directory names stay chronological, which a version 4 id would
 * scatter.
 *
 * Only the Host mints these, but this module stays browser-safe (no `node:*`
 * imports) so it can be shared with previews and unit tests.
 *
 * @module dsh-multi-workspace/shared/uuid
 */

/** Shape of every UUID string this package accepts or produces. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Version nibble of the ids this package mints. */
const VERSION_7 = 0x70

/** RFC 9562 variant bits: `10` in the two most significant bits of byte 8. */
const VARIANT_RFC = 0x80

/** Mask that clears the four version bits of byte 6. */
const VERSION_MASK = 0x0f

/** Mask that keeps the six payload bits of byte 8. */
const VARIANT_MASK = 0x3f

/** Highest value of the 12-bit monotonic counter that rides in `rand_a`. */
const COUNTER_MAX = 0xfff

/** Byte width of one UUID. */
const BYTE_LENGTH = 16

/** Default source of randomness: the platform CSPRNG, falling back to `Math.random`. */
function randomBytes(target: Uint8Array): void {
  const source = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } })
    .crypto
  if (source !== undefined && typeof source.getRandomValues === 'function') {
    source.getRandomValues(target)
    return
  }
  for (let index = 0; index < target.length; index += 1) {
    target[index] = Math.floor(Math.random() * 256)
  }
}

/** Millisecond stamp of the most recently minted id. */
let lastTimestamp = 0

/** Monotonic counter shared by ids minted inside the same millisecond. */
let counter = 0

/**
 * Mint one time-ordered UUID.
 *
 * Two ids minted in the same millisecond (or after a backwards clock step)
 * share the timestamp and are ordered by an incrementing 12-bit counter, so the
 * returned strings never sort out of order.
 *
 * @param now - Unix epoch milliseconds; defaults to the current clock.
 * @returns a `8-4-4-4-12` lower-case version 7 UUID.
 */
export function uuidv7(now: number = Date.now()): string {
  const timestamp = Number.isFinite(now) ? Math.max(0, Math.trunc(now)) : Date.now()
  if (timestamp > lastTimestamp) {
    lastTimestamp = timestamp
    counter = 0
  } else {
    // Same millisecond, or the clock stepped backwards: keep the newest stamp
    // so the ordering invariant holds and only the counter advances.
    counter = (counter + 1) & COUNTER_MAX
    if (counter === 0) lastTimestamp += 1
  }

  const bytes = new Uint8Array(BYTE_LENGTH)
  randomBytes(bytes)

  let stamp = lastTimestamp
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = stamp % 256
    stamp = Math.floor(stamp / 256)
  }
  bytes[6] = VERSION_7 | ((counter >> 8) & VERSION_MASK)
  bytes[7] = counter & 0xff
  bytes[8] = ((bytes[8] as number) & VARIANT_MASK) | VARIANT_RFC

  const hex: string[] = []
  for (let index = 0; index < BYTE_LENGTH; index += 1) {
    hex.push((bytes[index] as number).toString(16).padStart(2, '0'))
  }
  const joined = hex.join('')
  return [
    joined.slice(0, 8),
    joined.slice(8, 12),
    joined.slice(12, 16),
    joined.slice(16, 20),
    joined.slice(20),
  ].join('-')
}

/**
 * Whether a string is one of this package's UUID ids.
 * @param value - candidate directory or manifest identity.
 * @returns true for a well-formed UUID of any version.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

/**
 * Reset the monotonic clock. Tests call this between cases so one case's
 * counter cannot leak into another's expectations.
 * @internal
 */
export function resetUuidClock(): void {
  lastTimestamp = 0
  counter = 0
}
