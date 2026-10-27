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
      : `\nMembers (each entry is a symbolic link to an independent project folder):\n${members
          .map(member => `- ${member.name} -> ${member.target}`)
          .join('\n')}\n`
  return `This Session's directory is a combined workspace created by dsh-multi-workspace:
${workspacePath}
It is a real directory whose entries are symbolic links to independent project folders, and it is NOT a Git repository itself. Git does not descend into symbolic links, so several built-in tools behave differently here:
${memberLines}
- create_worktree / Git worktrees: do NOT call create_worktree at this root. It runs \`git check-ref-format\` and then \`git rev-parse --show-toplevel\` in the Session directory, and the latter fails with "not a git repository" because this root is not a repository. A worktree must live in the member repository's built-in pool \`<member>/.agents/worktrees/<name>\`:
  - preferred: change into the member first with the working_directory tool (\`{ "cd": "<member>" }\`). The Session then runs in the repository itself (it leaves this combined workspace), and create_worktree places the checkout at \`<member>/.agents/worktrees/<name>\` automatically;
  - manual alternative while staying here: \`git -C <member> worktree add <member>/.agents/worktrees/<name> -b <branch>\`, then use absolute paths inside the checkout. If the pool directory does not exist yet, create it and put a \`.gitignore\` containing \`*\` inside it so the checkout does not dirty \`git status\` (the built-in runtime does this itself);
  - never create worktrees as sibling directories of the repository (for example \`<repo>-<task>\`, \`<repo>_worktrees/<name>\`, or a direct child of this combined workspace root). Existing sibling checkouts shown by \`git worktree list\` are not the expected layout; do not imitate them;
  - under the workspace-write policy this flow writes outside the Session workspace root; if it is denied, apply the sandbox note below (suggest Full access once, then continue with permitted work — do not retry in a loop).
- grep / glob: when started at this combined workspace root, their ripgrep traversal does not follow symbolic links, so member-folder matches are silently skipped. Point grep/glob at a member path explicitly (for example path \`<member>/src\`) and they search it normally; for a root-wide search use bash with \`rg --follow <pattern> .\`.
- read / edit / write / bash: these follow the symbolic links and operate on the real member folders; writes land in the original folders.
- Sandbox: the workspace-write sandbox root is the Session's original directory (this combined workspace); changing directory into a member does not widen it, and every member folder resolves outside it. Writes into member folders (including \`<member>/.agents/worktrees\`) therefore fail until the Session uses danger-full-access. When a write you actually need is denied: mention it once, briefly, tell the user that combined workspaces need Full access for writes into member folders, and suggest switching the Session access mode to Full access (the access-mode selector in the message composer). This is a suggestion only — do not block, refuse, or stall the task because of it. If the user keeps workspace-write or read-only, respect that choice: continue with everything that is permitted (reads and operations inside this combined workspace root still work), clearly report which writes were skipped, and do not retry the denied operation in a loop. A per-call escalation (\`sandbox_permissions\` + \`justification\`) is available for one exact denied operation; use it only when the user asks for that operation, never automatically.
- Git at this root fails; run Git per member with \`git -C <member> ...\`.
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
