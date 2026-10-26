/**
 * Vendored from `@deepseek-ai/dsh-typert-protocol` 0.2.1-rc.3 (`remote-info.js`,
 * MIT). A generated Remote artifact only needs this lazy info factory; vendoring
 * it keeps this bundle free of runtime imports from the dsh installation, which
 * a profile-linked plugin cannot resolve.
 *
 * @module dsh-multi-workspace/shared/remote-info
 */

/** One generated codec projection; `create()` must return a schema with `parse`. */
export interface RemoteCodecSpec {
  mode: 'strict'
  typeSymbol: string
  create: () => { parse: (value: unknown) => unknown } & object
  description?: string
  jsonSchema?: Record<string, unknown>
  jsonSchemaError?: string
  decode?: (value: unknown) => unknown
  encode?: (value: unknown, writeBytes: (bytes: Uint8Array, path: (string | number)[]) => null) => unknown
}

/** One generated parameter of a Remote method. */
export interface RemoteSpecParameter {
  name: string
  wire?: string
  description?: string
  source: 'json' | 'lookup'
  lookup?: string
  codec: RemoteCodecSpec
  strictCodec?: RemoteCodecSpec
  acceptsUndefined?: boolean
}

/** One generated Remote method definition. */
export interface RemoteSpecMethod {
  service: string
  description?: string
  invocation: { kind: 'direct' } | { kind: 'context'; context: string; wire: string; codec: RemoteCodecSpec }
  parameters: RemoteSpecParameter[]
  result: RemoteCodecSpec
  mode?: 'stream'
  cancellation?: { parameter: 'signal' }
  scope?: { context: string; wire: string }
  sourceLocation?: { file: string; line: number; column: number }
}

/** The compiler-produced method table of one package. */
export interface RemoteSpec {
  package: string
  methods: Record<string, RemoteSpecMethod>
}

/** A generated invocation descriptor, plus the direct-method helpers the generator adds. */
export interface RemoteMethodDescriptor {
  readonly id: string
  readonly namespace: string
  readonly method: string
  readonly service: string
  readonly invocation: RemoteSpecMethod['invocation']
  readonly parameters: (RemoteSpecParameter & { wire: string })[]
  readonly result: RemoteCodecSpec
  readonly mode?: 'stream'
  readonly cancellation?: { parameter: 'signal' }
  readonly scope?: { context: string; wire: string }
  readonly sourceLocation?: { file: string; line: number; column: number }
  input?: (options?: { strict?: boolean }) => { parse: (input: unknown) => Record<string, unknown> }
  invoke?: (remote: unknown, input: Record<string, unknown>, signal?: AbortSignal) => unknown
}

/** The mountable shape `ctx.remote.$mount()` and the Host typert loader consume. */
export interface RemoteInfo {
  readonly package: string
  readonly descriptors: RemoteMethodDescriptor[]
  readonly methods: Record<string, RemoteMethodDescriptor>
}

/** Lazily built named-argument parser for a direct method (unused by the Gateway path). */
class NamedInput {
  readonly #parameters: (RemoteSpecParameter & { wire: string })[]
  readonly #strict: boolean
  readonly #zod: { object: (shape: Record<string, unknown>) => { parse: (input: unknown) => Record<string, unknown> } }

  constructor(
    parameters: (RemoteSpecParameter & { wire: string })[],
    strict: boolean,
    zod: { object: (shape: Record<string, unknown>) => { parse: (input: unknown) => Record<string, unknown> } },
  ) {
    this.#parameters = parameters
    this.#strict = strict
    this.#zod = zod
  }

  parse(input: unknown): Record<string, unknown> {
    const shape: Record<string, unknown> = {}
    for (const parameter of this.#parameters) {
      const codec = this.#strict ? (parameter.strictCodec ?? parameter.codec) : parameter.codec
      shape[parameter.wire] = codec.create()
    }
    if (this.#strict) return this.#zod.object(shape).parse(input)
    return this.#zod.object(shape).parse(input)
  }
}

class RemoteInfoImpl implements RemoteInfo {
  readonly #spec: RemoteSpec
  readonly #zod: unknown
  #index: { descriptors: RemoteMethodDescriptor[]; methods: Record<string, RemoteMethodDescriptor> } | undefined

  constructor(spec: RemoteSpec, zod: unknown) {
    this.#spec = spec
    this.#zod = zod
  }

  get package(): string {
    return this.#spec.package
  }

  get descriptors(): RemoteMethodDescriptor[] {
    return this.#resolve().descriptors
  }

  get methods(): Record<string, RemoteMethodDescriptor> {
    return this.#resolve().methods
  }

  #resolve(): { descriptors: RemoteMethodDescriptor[]; methods: Record<string, RemoteMethodDescriptor> } {
    if (this.#index !== undefined) return this.#index
    const descriptors: RemoteMethodDescriptor[] = []
    const methods: Record<string, RemoteMethodDescriptor> = Object.create(null)
    for (const [endpoint, definition] of Object.entries(this.#spec.methods)) {
      const separator = endpoint.indexOf('/')
      const namespace = endpoint.slice(0, separator)
      const method = endpoint.slice(separator + 1)
      const parameters = definition.parameters.map(parameter => ({
        ...parameter,
        wire: parameter.wire ?? parameter.name,
      }))
      const result = definition.result
      const descriptor: RemoteMethodDescriptor = {
        ...definition,
        id: `${this.#spec.package}#${endpoint}`,
        namespace,
        method,
        parameters,
        result,
      }
      if (definition.invocation.kind === 'direct') {
        const inputs: (NamedInput | undefined)[] = []
        const zodRuntime = zodRef(this.#zod)
        Object.assign(descriptor, {
          input(options?: { strict?: boolean }) {
            const strict = options?.strict === true
            const index = strict ? 1 : 0
            return (inputs[index] ??= new NamedInput(parameters, strict, zodRuntime))
          },
          invoke(remote: unknown, input: Record<string, unknown>, signal?: AbortSignal) {
            const values = parameters.map(parameter => input[parameter.wire])
            if (definition.cancellation !== undefined) values.push(signal)
            const receiver = Reflect.get(remote as object, namespace) as Record<string, (...args: unknown[]) => unknown>
            const call = receiver[method]
            return call?.apply(receiver, values)
          },
        })
        methods[endpoint] = descriptor
      }
      descriptors.push(descriptor)
    }
    this.#index = { descriptors, methods }
    return this.#index
  }
}

function zodRef(zod: unknown): { object: (shape: Record<string, unknown>) => { parse: (input: unknown) => Record<string, unknown> } } {
  return zod as { object: (shape: Record<string, unknown>) => { parse: (input: unknown) => Record<string, unknown> } }
}

/**
 * Retain one generated definition per endpoint without constructing parsers.
 * @param spec - compiler-produced method facts and Zod factories.
 * @param zod - the generated artifact's Zod runtime for named-input parsers.
 * @returns a lazy, mountable info instance with no registration effects.
 */
export function createTypertRemoteInfo(spec: RemoteSpec, zod: unknown): RemoteInfo {
  return new RemoteInfoImpl(spec, zod)
}
