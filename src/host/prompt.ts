/**
 * Per-session guidance for combined workspaces.
 *
 * A combined workspace is a real directory whose entries are symlinks to
 * independent project folders. Several built-in tools assume "the session cwd
 * is one Git repository" and behave differently at that root, so the Host adds
 * one concise context contribution that explains the correct usage. The text is
 * registered through `ctx.systemPrompt.context()` with a provider, so it only
 * materializes for sessions whose effective directory is inside the plugin's
 * workspace root; normal single-directory workspaces see nothing.
 *
 * @module dsh-multi-workspace/host/prompt
 */
import { readFileSync, realpathSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { MANIFEST_FILE } from '../shared/rpc.js'

/** Unique name of the context contribution. */
export const GUIDANCE_CONTEXT_NAME = 'multi-workspace:tooling'

/** The Session surface the provider reads. */
export interface PromptSessionLike {
  readonly header?: { readonly cwd?: string }
}

/** The per-assembly context handed to the provider (the Agent rides on it at runtime). */
export interface PromptAssembleContextLike {
  readonly agent?: { readonly session?: PromptSessionLike }
}

/** Registry contract of `ctx.systemPrompt.context()`. */
export interface SystemPromptLike {
  context(definition: {
    name: string
    order: number
    required?: boolean
    text: (context: PromptAssembleContextLike) => string
  }): () => void
  getContextOrder?(name: string): number
}

/** The minimal Host context surface this module uses. */
export interface PromptHostContextLike {
  inject(dependencies: string[], callback: (scope: { systemPrompt: SystemPromptLike }) => void): void
}

/** One member link recorded in a combined workspace manifest. */
export interface WorkspaceMember {
  readonly name: string
  readonly target: string
}

/** Options of {@link registerCombinedWorkspaceGuidance}. */
export interface GuidanceOptions {
  /** Absolute directory that holds the combined workspaces. */
  rootDir: string
  /** Resolve the Session's effective directory (falls back to the header cwd). */
  resolveCwd: (session: PromptSessionLike | undefined) => string | undefined
}

/**
 * Every spelling a workspace root can appear as: the configured absolute path
 * and its real path (the dsh home itself may be symlinked).
 * @param rootDir - configured combined-workspace root.
 * @returns unique absolute variants.
 */
export function workspaceRootVariants(rootDir: string): string[] {
  const variants = new Set<string>([resolve(rootDir)])
  try {
    variants.add(resolve(realpathSync(rootDir)))
  } catch {
    // A missing root keeps the resolved variant; realpath is only an extra match.
  }
  return [...variants]
}

/**
 * Whether one directory is the workspace root itself or below it.
 * @param candidate - absolute directory to test.
 * @param roots - absolute root variants.
 * @returns true for the root and its descendants.
 */
export function isInsideRoot(candidate: string, roots: readonly string[]): boolean {
  const normalized = resolve(candidate)
  if (matchesRoot(normalized, roots)) return true
  try {
    // The Session may address the workspace through a symlinked dsh home; the
    // real path decides when both spellings exist.
    return matchesRoot(resolve(realpathSync(normalized)), roots)
  } catch {
    return false
  }
}

function matchesRoot(normalized: string, roots: readonly string[]): boolean {
  return roots.some(root => normalized === root || normalized.startsWith(`${root}${sep}`))
}

/**
 * Whether an effective Session directory belongs to a combined workspace.
 * @param cwd - effective Session directory, when known.
 * @param rootDir - combined-workspace root.
 * @returns true when the Session runs inside the plugin's workspace root.
 */
export function isCombinedWorkspacePath(cwd: string | undefined, rootDir: string): boolean {
  if (cwd === undefined || cwd.trim() === '') return false
  return isInsideRoot(cwd, workspaceRootVariants(rootDir))
}

/**
 * Read the member links of one combined workspace from its hidden manifest.
 * @param workspacePath - combined workspace directory.
 * @returns recorded members, or an empty list when the manifest is missing/invalid.
 */
export function readWorkspaceMembers(workspacePath: string): WorkspaceMember[] {
  try {
    const raw = readFileSync(join(workspacePath, MANIFEST_FILE), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return []
    const links = (parsed as { links?: unknown }).links
    if (!Array.isArray(links)) return []
    const members: WorkspaceMember[] = []
    for (const link of links) {
      if (typeof link !== 'object' || link === null) continue
      const name = (link as { name?: unknown }).name
      const target = (link as { target?: unknown }).target
      if (typeof name === 'string' && typeof target === 'string' && name !== '' && target !== '') {
        members.push({ name, target })
      }
    }
    return members
  } catch {
    return []
  }
}

/**
 * Build the model-facing guidance for one combined workspace.
 * @param workspacePath - effective Session directory (the combined workspace).
 * @param members - recorded member links, if available.
 * @returns one concise context block explaining the tool differences.
 */
export function buildCombinedWorkspaceGuidance(
  workspacePath: string,
  members: readonly WorkspaceMember[] = [],
): string {
  const memberLines =
    members.length === 0
      ? ''
      : `\nMembers:\n${members.map(member => `- ${member.name} -> ${member.target}`).join('\n')}\n`
  return `This Session's directory is a combined workspace created by dsh-multi-workspace:
${workspacePath}
It is a directory of symlinks to independent project folders, not a Git repository.
${memberLines}
- Worktrees: do not call create_worktree at this root (it fails with "not a git repository"). Create it inside the member's pool: either \`working_directory({ "cd": "<member>" })\` first and then \`create_worktree\` (the runtime makes the pool and its \`.gitignore\`), or \`git -C <member> worktree add <member>/.agents/worktrees/<name> -b <branch>\`. Never create sibling worktree directories.
- grep/glob: a search started here skips the symlinked members; search a member path explicitly (\`<member>/...\`) or use bash \`rg --follow\`.
- read/edit/write/bash: follow the symlinks and operate on the real member folders.
- Sandbox: under workspace-write, member folders are outside the Session workspace root (\`working_directory\` does not widen it), so writes there are denied. If a needed write is denied, say once that switching the Session to danger-full-access allows it; continue with permitted work — do not block the task and do not retry in a loop. Per-call escalation is only for a specific operation the user asks for.
- Git: use \`git -C <member> ...\`.
`
}

/**
 * Register the combined-workspace guidance as one runtime context contribution.
 * The provider returns an empty string outside the plugin's workspace root, so
 * ordinary workspaces are untouched.
 * @param ctx - Host plugin context (must expose the Cordis `inject` mixin).
 * @param options - workspace root and effective-directory resolver.
 */
export function registerCombinedWorkspaceGuidance(ctx: PromptHostContextLike, options: GuidanceOptions): void {
  const roots = workspaceRootVariants(options.rootDir)
  ctx.inject(['systemPrompt'], scope => {
    const fallbackOrder = 115
    const order =
      typeof scope.systemPrompt.getContextOrder === 'function'
        ? scope.systemPrompt.getContextOrder('SANDBOX_POLICY') + 5
        : fallbackOrder
    scope.systemPrompt.context({
      name: GUIDANCE_CONTEXT_NAME,
      order,
      required: true,
      text: assemble => {
        const cwd = options.resolveCwd(assemble.agent?.session)
        if (cwd === undefined || !isInsideRoot(cwd, roots)) return ''
        return buildCombinedWorkspaceGuidance(cwd, readWorkspaceMembers(cwd))
      },
    })
  })
}
