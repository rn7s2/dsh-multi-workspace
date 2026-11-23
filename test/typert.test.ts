import { describe, expect, it } from 'vitest'
import { TYPERT } from '../src/host/typert.js'
import { listingResultSchema, workspaceInfoSchema } from '../src/shared/rpc.js'

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

  it('carries the canonical entry path on the wire so the browser can grey members out', () => {
    const schema = list?.result.jsonSchema as
      | { properties: { entries: { items: { properties: Record<string, unknown> } } } }
      | undefined
    expect(schema?.properties.entries.items.properties['real']).toBeDefined()
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

describe('wire codecs keep the canonical entry path', () => {
  it('preserves `real` through the listing result codec', () => {
    const parsed = listingResultSchema.parse({
      path: '/home/me',
      home: '/home/me',
      crumbs: [{ name: '/', path: '/', hidden: false }],
      entries: [
        { name: 'alpha', path: '/var/alpha', hidden: false, real: '/data/alpha' },
        { name: 'beta', path: '/home/me/beta', hidden: false },
      ],
      truncated: false,
    })
    expect(parsed.entries[0]?.real).toBe('/data/alpha')
    expect(parsed.entries[1]?.real).toBeUndefined()
  })

  it('preserves the in-use flag through the workspace info codec', () => {
    const parsed = workspaceInfoSchema.parse({
      path: '/ws',
      title: 'alpha and beta',
      titleAuto: true,
      members: [
        { name: 'alpha', target: '/data/alpha', inUse: true },
        { name: 'beta', target: '/data/beta' },
      ],
    })
    expect(parsed.members[0]?.inUse).toBe(true)
  })
})
