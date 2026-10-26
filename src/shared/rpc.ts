/**
 * Wire contract shared by the Host service, the Host Typert artifact, and the
 * Client dialog. One Remote method creates a combined workspace.
 *
 * @module dsh-multi-workspace/shared/rpc
 */
import { z } from 'zod'

/** Package name used by Typert Remote identity and the Client contribution. */
export const PACKAGE_NAME = 'dsh-multi-workspace'

/** Cordis service key / Typert namespace of the Host service. */
export const NAMESPACE = 'multiWorkspace'

/** Remote endpoint method name: create a combined workspace. */
export const CREATE_METHOD = 'create'

/** Full Remote endpoint of the create method. */
export const CREATE_ENDPOINT = `${NAMESPACE}/${CREATE_METHOD}`

/** Remote endpoint method name: open the native macOS multi-folder picker. */
export const PICK_METHOD = 'pick'

/** Full Remote endpoint of the pick method. */
export const PICK_ENDPOINT = `${NAMESPACE}/${PICK_METHOD}`

/** Fixed subdirectory of the dsh home that holds every real combined workspace. */
export const WORKSPACE_ROOT_SEGMENTS = ['multi-workspaces'] as const

/** Hidden metadata file written inside each combined workspace directory. */
export const MANIFEST_FILE = '.dsh-multi-workspace.json'

/** Request of `multiWorkspace/create`: the selected source directories. */
export interface WorkspaceCreateRequest {
  /** Absolute paths of existing directories, in the order the operator selected them. */
  paths: string[]
  /** Optional explicit title; omitted means the derived "A, B and C" name. */
  title?: string
}

/** One symlink created inside the combined workspace directory. */
export interface WorkspaceLink {
  /** Name of the entry inside the combined workspace directory. */
  name: string
  /** Absolute target directory the entry points at. */
  target: string
}

/** Result of `multiWorkspace/create`. `created` is false when the registration already existed. */
export interface WorkspaceCreateResult {
  /** Absolute path of the real combined workspace directory. */
  path: string
  /** Durable Workspace title (the derived default name unless `title` was supplied). */
  title: string
  /** Durable Workspace id. */
  workspaceId: string
  /** Whether this call materialized a new directory and registration. */
  created: boolean
  /** The symlinks in the combined workspace directory. */
  links: WorkspaceLink[]
  /** Canonical source directories, in selection order. */
  sources: string[]
}

const zLink = z.object({
  name: z.string().min(1),
  target: z.string().min(1),
})

/** Bounded request codec; mirrored by the Host Typert artifact. */
export const createRequestSchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(64),
  title: z.string().min(1).max(512).optional(),
})

/** Result codec; the Gateway uses it only for its strict projection. */
export const createResultSchema = z.object({
  path: z.string().min(1),
  title: z.string().min(1),
  workspaceId: z.string().min(1),
  created: z.boolean(),
  links: z.array(zLink),
  sources: z.array(z.string().min(1)),
})

/** Request codec of `multiWorkspace/pick`: the native panel prompt. */
export const pickMessageSchema = z.string().min(1).max(200)

/** Result codec of `multiWorkspace/pick`: picked absolute paths, or null when cancelled. */
export const pickResultSchema = z.union([z.null(), z.array(z.string().min(1))])
