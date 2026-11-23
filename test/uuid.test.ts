import { beforeEach, describe, expect, it } from 'vitest'
import { UUID_PATTERN, isUuid, resetUuidClock, uuidv7 } from '../src/shared/uuid.js'

beforeEach(() => {
  resetUuidClock()
})

describe('uuidv7', () => {
  it('returns a well-formed UUID', () => {
    const id = uuidv7()
    expect(id).toMatch(UUID_PATTERN)
    expect(id.length).toBe(36)
    expect(id).toBe(id.toLowerCase())
  })

  it('carries version 7 and the RFC variant', () => {
    for (let index = 0; index < 50; index += 1) {
      const id = uuidv7()
      expect(id[14]).toBe('7')
      expect(['8', '9', 'a', 'b']).toContain(id[19])
    }
  })

  it('encodes the timestamp in the leading 48 bits', () => {
    const now = 1_763_000_000_000
    const id = uuidv7(now)
    const stamp = Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16)
    expect(stamp).toBe(now)
  })

  it('sorts lexicographically in creation order across milliseconds', () => {
    const earlier = uuidv7(1_700_000_000_000)
    const later = uuidv7(1_700_000_000_001)
    const muchLater = uuidv7(1_800_000_000_000)
    expect([muchLater, later, earlier].sort()).toEqual([earlier, later, muchLater])
  })

  it('keeps order inside one millisecond by advancing the counter', () => {
    const stamp = 1_700_000_000_500
    const ids = Array.from({ length: 200 }, () => uuidv7(stamp))
    expect([...ids].sort()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('stays ordered when the clock steps backwards', () => {
    const first = uuidv7(1_700_000_000_900)
    const second = uuidv7(1_700_000_000_100)
    expect(second > first).toBe(true)
  })

  it('survives a counter overflow inside one millisecond', () => {
    const stamp = 1_700_000_001_000
    const ids = Array.from({ length: 4_100 }, () => uuidv7(stamp))
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(ids)
  })

  it('falls back to the current clock for a non-finite input', () => {
    const id = uuidv7(Number.NaN)
    expect(isUuid(id)).toBe(true)
    const stamp = Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16)
    expect(Math.abs(stamp - Date.now())).toBeLessThan(5_000)
  })
})

describe('isUuid', () => {
  it('accepts a minted id', () => {
    expect(isUuid(uuidv7())).toBe(true)
  })

  it('rejects a legacy directory name', () => {
    expect(isUuid('alpha-beta')).toBe(false)
    expect(isUuid('')).toBe(false)
    expect(isUuid('00000000-0000-7000-8000-00000000000')).toBe(false)
  })
})
