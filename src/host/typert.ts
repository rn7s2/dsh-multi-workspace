/**
 * Host Typert manifest: `dsh-typert-loader` imports this module's `TYPERT`
 * export for every Loader entry whose package publishes `./typert`.
 *
 * @module dsh-multi-workspace/host/typert
 */
import { z } from 'zod'
import { createTypertRemoteInfo } from '../shared/remote-info.js'
import { buildRemoteSpec } from '../shared/remote-spec.js'
import { CREATE_METHOD, NAMESPACE, PACKAGE_NAME } from '../shared/rpc.js'

const $remote = createTypertRemoteInfo(buildRemoteSpec(), z)

const serviceDescription =
  'Creates one combined workspace: a real directory under the dsh home whose entries are symlinks to the selected folders, and opens the native macOS multi-folder picker.'
const createDescription =
  'Materialize a real directory under ~/.dsh/multi-workspaces, symlink each selected folder into it, and register the durable Workspace with the derived title.'
const createJsDoc = `/**\n * Materialize a real directory under ~/.dsh/multi-workspaces, symlink each\n * selected folder into it, and register the durable Workspace with the derived\n * "A, B and C" title.\n * @param request - the folder paths and an optional title override.\n * @returns the created workspace directory, its links, and its durable registration.\n */`
const pickDescription =
  'Open the native macOS folder panel with multiple selection enabled and return the picked absolute folder paths, or null when cancelled.'
const pickJsDoc = `/**\n * Open the native macOS folder panel with multiple selection enabled.\n * @param message - prompt shown inside the panel.\n * @returns the picked absolute folder paths, or null when cancelled.\n */`

/**
 * The generated-artifact-shaped manifest consumed by `@deepseek-ai/dsh-typert-loader`.
 */
export const TYPERT = {
  package: PACKAGE_NAME,
  face: 'host' as const,
  schemas: [] as unknown[],
  get invocations() {
    return $remote.descriptors
  },
  model: {
    services: [
      {
        description: serviceDescription,
        summary: serviceDescription,
        tags: [] as unknown[],
        jsDoc: `/** ${serviceDescription} */`,
        key: NAMESPACE,
        exportName: 'default',
        members: [
          {
            kind: 'method',
            name: 'pick',
            signature: 'async pick(message: string): Promise<string[] | null>',
            summary: pickDescription,
            jsDoc: pickJsDoc,
          },
          {
            kind: 'method',
            name: CREATE_METHOD,
            signature: 'async create(request: WorkspaceCreateRequest): Promise<WorkspaceCreateResult>',
            summary: createDescription,
            jsDoc: createJsDoc,
          },
        ],
        types: [] as unknown[],
      },
    ],
    events: [] as unknown[],
    objects: [] as unknown[],
  },
}

export default TYPERT
