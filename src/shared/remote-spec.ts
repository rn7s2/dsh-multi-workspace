/**
 * The three Typert Remote methods this package publishes. The same spec feeds
 * the Host manifest (`src/host/typert.ts`) and the Client contribution
 * (`src/client/remote.ts`), so the two faces cannot drift.
 *
 * @module dsh-multi-workspace/shared/remote-spec
 */
import { z } from 'zod'
import type { RemoteCodecSpec, RemoteSpec } from './remote-info.js'
import {
  CREATE_ENDPOINT,
  LIST_ENDPOINT,
  NAMESPACE,
  PACKAGE_NAME,
  PICK_ENDPOINT,
  createRequestSchema,
  createResultSchema,
  listPathSchema,
  listingResultSchema,
  pickMessageSchema,
  pickResultSchema,
} from './rpc.js'

const requestJsonSchema = {
  type: 'object',
  properties: {
    paths: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 64,
      description: 'Absolute paths of the folders to link, in selection order.',
    },
    title: { type: 'string', description: 'Optional explicit title override.' },
  },
  required: ['paths'],
  additionalProperties: false,
  description: 'The folders to link and an optional explicit title override.',
} as const

const resultJsonSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Absolute path of the real combined workspace directory.' },
    title: { type: 'string', description: 'Durable Workspace title.' },
    workspaceId: { type: 'string', description: 'Durable Workspace id.' },
    created: { type: 'boolean', description: 'Whether this call materialized the workspace.' },
    links: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, target: { type: 'string' } },
        required: ['name', 'target'],
        additionalProperties: false,
      },
    },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['path', 'title', 'workspaceId', 'created', 'links', 'sources'],
  additionalProperties: false,
  description: 'The materialized combined workspace directory and its durable registration.',
} as const

const pickResultJsonSchema = {
  oneOf: [
    { type: 'null' },
    { type: 'array', items: { type: 'string' }, description: 'Picked absolute folder paths.' },
  ],
  description: 'The picked absolute folder paths, or null when the operator cancelled.',
} as const

const entryJsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    path: { type: 'string' },
    hidden: { type: 'boolean' },
  },
  required: ['name', 'path', 'hidden'],
  additionalProperties: false,
} as const

const listingJsonSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Absolute path of the listed directory.' },
    home: { type: 'string', description: "The host account's home directory." },
    crumbs: {
      type: 'array',
      items: entryJsonSchema,
      description: 'Ancestor chain from the filesystem root to the listed directory inclusive.',
    },
    entries: {
      type: 'array',
      items: entryJsonSchema,
      description: 'Direct child directories, name-sorted; symlinks to directories included.',
    },
    truncated: { type: 'boolean', description: 'Whether the level was cut at the result bound.' },
  },
  required: ['path', 'home', 'crumbs', 'entries', 'truncated'],
  additionalProperties: false,
  description: 'One directory level and its ancestry for the in-app browser.',
} as const

/** Strict parameter codec for the create request object. */
const requestCodec: RemoteCodecSpec = {
  mode: 'strict',
  typeSymbol: `${PACKAGE_NAME}#WorkspaceCreateRequest`,
  create: () => createRequestSchema,
  jsonSchema: requestJsonSchema,
  description: 'the folders to link and an optional explicit title override.',
}

/** Strict result codec of create (the Gateway only projects it; no output encoding needed). */
const resultCodec: RemoteCodecSpec = {
  mode: 'strict',
  typeSymbol: `${PACKAGE_NAME}#WorkspaceCreateResult`,
  create: () => createResultSchema,
  jsonSchema: resultJsonSchema,
  description: 'the materialized combined workspace directory and its durable registration.',
}

/** Strict parameter codec of pick: the native panel prompt. */
const pickMessageCodec: RemoteCodecSpec = {
  mode: 'strict',
  typeSymbol: `${PACKAGE_NAME}#PickMessage`,
  create: () => pickMessageSchema,
  jsonSchema: { type: 'string', minLength: 1, maxLength: 200 },
  description: 'the prompt the native macOS folder panel shows.',
}

/** Strict result codec of pick. */
const pickResultCodec: RemoteCodecSpec = {
  mode: 'strict',
  typeSymbol: `${PACKAGE_NAME}#PickResult`,
  create: () => pickResultSchema,
  jsonSchema: pickResultJsonSchema,
  description: 'the picked absolute folder paths, or null when the operator cancelled.',
}

/** Parameter codec of list: an absolute directory, or null for the home directory. */
const listPathCodec: RemoteCodecSpec = {
  mode: 'strict',
  typeSymbol: `${PACKAGE_NAME}#ListPath`,
  create: () => listPathSchema,
  jsonSchema: { oneOf: [{ type: 'null' }, { type: 'string', minLength: 1 }] },
  description: 'absolute directory to list; null lists the home directory.',
}

/** Result codec of list: one bounded directory level and its ancestry. */
const listingResultCodec: RemoteCodecSpec = {
  mode: 'strict',
  typeSymbol: `${PACKAGE_NAME}#DirectoryListing`,
  create: () => listingResultSchema,
  jsonSchema: listingJsonSchema,
  description: 'one directory level and its ancestry for the in-app browser.',
}

/**
 * Build the compiler-shaped Remote spec both faces publish.
 * @returns the Remote spec accepted by `createTypertRemoteInfo()`.
 */
export function buildRemoteSpec(): RemoteSpec {
  return {
    package: PACKAGE_NAME,
    methods: {
      [LIST_ENDPOINT]: {
        service: NAMESPACE,
        description:
          'List one directory level for the in-app browser: absolute child directories only, name-sorted, with hidden flags and ancestry.',
        invocation: { kind: 'direct' },
        parameters: [
          {
            name: 'path',
            description: 'absolute directory to list; null lists the home directory.',
            source: 'json',
            codec: listPathCodec,
          },
        ],
        result: listingResultCodec,
        sourceLocation: { file: 'src/host/listing.ts', line: 1, column: 1 },
      },
      [PICK_ENDPOINT]: {
        service: NAMESPACE,
        description:
          'Open the native macOS folder panel with multiple selection enabled and return the picked absolute folder paths, or null when cancelled. A host without a local macOS display refuses and the Client opens the in-app browser instead.',
        invocation: { kind: 'direct' },
        parameters: [
          {
            name: 'message',
            description: 'the prompt the native macOS folder panel shows.',
            source: 'json',
            codec: pickMessageCodec,
          },
        ],
        result: pickResultCodec,
        sourceLocation: { file: 'src/host/native-picker.ts', line: 1, column: 1 },
      },
      [CREATE_ENDPOINT]: {
        service: NAMESPACE,
        description:
          'Create one combined workspace from two or more folders: materialize a real directory under the dsh home, symlink every selected folder into it, and register the durable Workspace with the derived "A, B and C" title.',
        invocation: { kind: 'direct' },
        parameters: [
          {
            name: 'request',
            description: 'the folders to link and an optional explicit title override.',
            source: 'json',
            codec: requestCodec,
          },
        ],
        result: resultCodec,
        sourceLocation: { file: 'src/host/index.ts', line: 1, column: 1 },
      },
    },
  }
}
