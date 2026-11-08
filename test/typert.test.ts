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

  it('lists the new method in the model service members', () => {
    const members = TYPERT.model.services[0]?.members as unknown as ModelMember[]
    expect(members.some(member => member.name === 'list')).toBe(true)
  })
})
