import { describe, expect, it, vi } from 'vitest'
import { parsePickerOutput, pickNativeDirectories } from '../src/host/native-picker.js'

describe('parsePickerOutput', () => {
  it('returns null for empty output (operator cancelled)', () => {
    expect(parsePickerOutput('')).toBeNull()
    expect(parsePickerOutput('\n')).toBeNull()
    expect(parsePickerOutput('  \r\n')).toBeNull()
  })

  it('parses a JSON array of absolute paths', () => {
    expect(parsePickerOutput('["/tmp/a","/tmp/b"]')).toEqual(['/tmp/a', '/tmp/b'])
    expect(parsePickerOutput('["/tmp/a","/tmp/b"]\n')).toEqual(['/tmp/a', '/tmp/b'])
  })

  it('accepts an explicitly empty selection array', () => {
    expect(parsePickerOutput('[]')).toEqual([])
  })

  it('rejects invalid JSON, non-arrays and non-string entries', () => {
    expect(() => parsePickerOutput('not-json')).toThrow(/invalid output/)
    expect(() => parsePickerOutput('{"a":1}')).toThrow(/non-array/)
    expect(() => parsePickerOutput('["/a", 2]')).toThrow(/non-string/)
    expect(() => parsePickerOutput('[""]')).toThrow(/non-string/)
  })
})

describe('pickNativeDirectories', () => {
  it('rejects non-macOS platforms with an actionable message and never spawns', async () => {
    const run = vi.fn()
    await expect(pickNativeDirectories('pick', { platform: 'linux', run })).rejects.toThrow(
      /only supported on macOS/,
    )
    expect(run).not.toHaveBeenCalled()
  })

  it('runs osascript with a multi-selection NSOpenPanel script and parses the selection', async () => {
    const run = vi.fn(async () => ({ stdout: '["/tmp/one","/tmp/two"]\n', stderr: '' }))
    const paths = await pickNativeDirectories('Choose folders', { platform: 'darwin', run })
    expect(paths).toEqual(['/tmp/one', '/tmp/two'])
    expect(run).toHaveBeenCalledTimes(1)
    const call = run.mock.calls[0]
    expect(call).toBeDefined()
    const [command, args] = call as unknown as [string, string[]]
    expect(command).toBe('osascript')
    expect(args[0]).toBe('-l')
    expect(args[1]).toBe('JavaScript')
    expect(args[2]).toBe('-e')
    expect(args[3]).toContain('allowsMultipleSelection = true')
    expect(args[3]).toContain('NSOpenPanel')
    expect(args[3]).toContain('canChooseDirectories = true')
    expect(args[4]).toBe('Choose folders')
  })

  it('returns null when the operator cancels the panel', async () => {
    const run = vi.fn(async () => ({ stdout: '', stderr: '' }))
    await expect(pickNativeDirectories('pick', { platform: 'darwin', run })).resolves.toBeNull()
  })

  it('propagates chooser launch failures', async () => {
    const run = vi.fn(async () => {
      throw new Error('osascript: command not found')
    })
    await expect(pickNativeDirectories('pick', { platform: 'darwin', run })).rejects.toThrow(
      /command not found/,
    )
  })
})
