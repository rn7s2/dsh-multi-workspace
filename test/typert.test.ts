import { describe, expect, it } from 'vitest'
import { TYPERT } from '../src/host/typert.js'

/** Minimal shape of one generated invocation the assertions read. */
interface Invocation {
  namespace: string
  method: string
  parameters: {
    name: string
    acceptsUndefined?: boolean
    codec: { jsonSchema?: Record<string, unknown> }
  }[]
  result: { jsonSchema?: Record<string, unknown> }
}

/** Minimal shape of the manifest's model member entries. */
interface ModelMember {
  kind: string
  name: string
  signature: string
}

describe('Host Typert manifest', () => {
  const invocations = TYPERT.invocations as unknown as Invocation[]
  const list = invocations.find(entry => entry.namespace === 'multiWorkspace' && entry.method === 'list')

  it('registers the list invocation with an explicit nullable path', () => {
    expect(list).toBeDefined()
    const parameter = list?.parameters[0]
    expect(parameter?.name).toBe('path')
    expect(parameter?.acceptsUndefined).toBeUndefined()
    expect(parameter?.codec.jsonSchema).toMatchObject({
      oneOf: [{ type: 'null' }, { type: 'string' }],
    })
  })

  it('registers the listing result shape', () => {
    expect(list?.result.jsonSchema).toMatchObject({
      type: 'object',
      required: ['path', 'home', 'crumbs', 'entries', 'truncated'],
    })
  })

  it('keeps the existing pick and create invocations', () => {
    expect(
      invocations.some(entry => entry.namespace === 'multiWorkspace' && entry.method === 'pick'),
    ).toBe(true)
    expect(
      invocations.some(entry => entry.namespace === 'multiWorkspace' && entry.method === 'create'),
    ).toBe(true)
  })

  it('registers the inspect, add and remove invocations', () => {
    for (const method of ['inspect', 'addFolders', 'removeFolders']) {
      const invocation = invocations.find(
        entry => entry.namespace === 'multiWorkspace' && entry.method === method,
      )
      expect(invocation, method).toBeDefined()
      expect(invocation?.parameters[0]?.name).toBe('request')
      expect(invocation?.result.jsonSchema).toBeDefined()
    }
  })

  it('describes inspect as nullable', () => {
    const inspect = invocations.find(
      entry => entry.namespace === 'multiWorkspace' && entry.method === 'inspect',
    )
    expect(inspect?.result.jsonSchema).toMatchObject({
      oneOf: [{ type: 'null' }, { type: 'object' }],
    })
  })

  it('lists every method in the model service members', () => {
    const members = TYPERT.model.services[0]?.members as unknown as ModelMember[]
    const names = members.map(member => member.name)
    expect(names).toEqual(
      expect.arrayContaining(['list', 'pick', 'create', 'inspect', 'addFolders', 'removeFolders']),
    )
  })
})
