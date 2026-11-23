/**
 * Wire contract shared by the Host service, the Host Typert artifact, and the
 * Client surfaces. Every method that mutates a combined workspace names it by
 * its absolute directory: the id is stamped into the directory name and the
 * hidden manifest, so a caller never has to carry it separately.
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

/** Remote endpoint method name: list one directory level for the in-app browser. */
export const LIST_METHOD = 'list'

/** Full Remote endpoint of the list method. */
export const LIST_ENDPOINT = `${NAMESPACE}/${LIST_METHOD}`

/** Remote endpoint method name: describe one combined workspace. */
export const INSPECT_METHOD = 'inspect'

/** Full Remote endpoint of the inspect method. */
export const INSPECT_ENDPOINT = `${NAMESPACE}/${INSPECT_METHOD}`

/** Remote endpoint method name: add folders to an existing combined workspace. */
export const ADD_METHOD = 'addFolders'

/** Full Remote endpoint of the add method. */
export const ADD_ENDPOINT = `${NAMESPACE}/${ADD_METHOD}`

/** Remote endpoint method name: remove folders from an existing combined workspace. */
export const REMOVE_METHOD = 'removeFolders'

/** Full Remote endpoint of the remove method. */
export const REMOVE_ENDPOINT = `${NAMESPACE}/${REMOVE_METHOD}`

/** Fixed subdirectory of the dsh home that holds every real combined workspace. */
export const WORKSPACE_ROOT_SEGMENTS = ['multi-workspaces'] as const

/** Hidden metadata file written inside each combined workspace directory. */
export const MANIFEST_FILE = '.dsh-multi-workspace.json'

/** Manifest schema version this build writes. */
export const MANIFEST_VERSION = 2

/** Fewest folders a combined workspace may hold; below it the directory is a plain workspace. */
export const MIN_MEMBERS = 2

/** One symlink inside the combined workspace directory. */
export interface WorkspaceLink {
  /** Name of the entry inside the combined workspace directory. */
  name: string
  /** Absolute target directory the entry points at. */
  target: string
}

/** Request of `multiWorkspace/create`: the selected source directories. */
export interface WorkspaceCreateRequest {
  /** Absolute paths of existing directories, in the order the operator selected them. */
  paths: string[]
  /** Optional explicit title; omitted means the derived "A, B and C" name. */
  title?: string
}

/** Result of `multiWorkspace/create`. `created` is false when an existing directory was adopted. */
export interface WorkspaceCreateResult {
  /** Absolute path of the real combined workspace directory. */
  path: string
  /** Durable Workspace title. */
  title: string
  /** Whether the title is still derived from the current folders. */
  titleAuto: boolean
  /** Durable Workspace id. */
  workspaceId: string
  /** Whether this call materialized a new directory and registration. */
  created: boolean
  /** The symlinks in the combined workspace directory. */
  links: WorkspaceLink[]
  /** Canonical source directories, in selection order. */
  sources: string[]
}

/** Request of `multiWorkspace/inspect`: one combined-workspace directory. */
export interface WorkspaceInspectRequest {
  /** Absolute path of a directory that may be a combined workspace. */
  path: string
}

/** Description of one combined workspace. */
export interface WorkspaceInfo {
  /** Absolute path of the real combined workspace directory. */
  path: string
  /** Durable Workspace title. */
  title: string
  /** Whether the title is still derived from the current folders. */
  titleAuto: boolean
  /** Symlinks in the directory, in the order they were added. */
  members: WorkspaceLink[]
  /** Durable Workspace id, when the directory is currently registered. */
  workspaceId?: string
}

/** Request of `multiWorkspace/addFolders`: folders to append to a combined workspace. */
export interface WorkspaceAddRequest {
  /** Absolute path of the combined workspace directory. */
  path: string
  /** Absolute paths of existing directories outside the workspace. */
  paths: string[]
}

/** Request of `multiWorkspace/removeFolders`: members to drop from a combined workspace. */
export interface WorkspaceRemoveRequest {
  /** Absolute path of the combined workspace directory. */
  path: string
  /** Entry names inside the combined workspace directory. */
  names: string[]
}

/** Result of an add or remove: the updated description. */
export interface WorkspaceUpdateResult {
  /** Absolute path of the real combined workspace directory. */
  path: string
  /** Durable Workspace title after the change. */
  title: string
  /** Whether the title is still derived from the current folders. */
  titleAuto: boolean
  /** Symlinks in the directory after the change. */
  members: WorkspaceLink[]
  /** Members that were added or removed by this call. */
  changed: WorkspaceLink[]
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
  titleAuto: z.boolean(),
  workspaceId: z.string().min(1),
  created: z.boolean(),
  links: z.array(zLink),
  sources: z.array(z.string().min(1)),
})

/** Request codec of `multiWorkspace/inspect`. */
export const inspectRequestSchema = z.object({
  path: z.string().min(1),
})

/** Result codec of `multiWorkspace/inspect`: null when the directory is not a combined workspace. */
export const workspaceInfoSchema = z.object({
  path: z.string().min(1),
  title: z.string().min(1),
  titleAuto: z.boolean(),
  members: z.array(zLink),
  workspaceId: z.string().min(1).optional(),
})

/** Result codec union of `multiWorkspace/inspect`. */
export const inspectResultSchema = z.union([z.null(), workspaceInfoSchema])

/** Request codec of `multiWorkspace/addFolders`. */
export const addRequestSchema = z.object({
  path: z.string().min(1),
  paths: z.array(z.string().min(1)).min(1).max(64),
})

/** Request codec of `multiWorkspace/removeFolders`. */
export const removeRequestSchema = z.object({
  path: z.string().min(1),
  names: z.array(z.string().min(1)).min(1).max(64),
})

/** Result codec of an add or remove. */
export const updateResultSchema = z.object({
  path: z.string().min(1),
  title: z.string().min(1),
  titleAuto: z.boolean(),
  members: z.array(zLink),
  changed: z.array(zLink),
})

/** Request codec of `multiWorkspace/pick`: the native panel prompt. */
export const pickMessageSchema = z.string().min(1).max(200)

/** Result codec of `multiWorkspace/pick`: picked absolute paths, or null when cancelled. */
export const pickResultSchema = z.union([z.null(), z.array(z.string().min(1))])

const zDirectoryEntry = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  hidden: z.boolean(),
})

/** Parameter codec of `multiWorkspace/list`: an absolute directory, or null for the home directory. */
export const listPathSchema = z.union([z.null(), z.string().min(1)])

/** Result codec of `multiWorkspace/list`: one bounded directory level and its ancestry. */
export const listingResultSchema = z.object({
  path: z.string().min(1),
  home: z.string().min(1),
  crumbs: z.array(zDirectoryEntry),
  entries: z.array(zDirectoryEntry),
  truncated: z.boolean(),
})
