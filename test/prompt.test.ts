import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  GUIDANCE_CONTEXT_NAME,
  buildCombinedWorkspaceGuidance,
  isCombinedWorkspacePath,
  isInsideRoot,
  readWorkspaceMembers,
  registerCombinedWorkspaceGuidance,
  workspaceRootVariants,
} from '../src/host/prompt.js'
import type { PromptAssembleContextLike, SystemPromptLike } from '../src/host/prompt.js'
import { MANIFEST_FILE } from '../src/shared/rpc.js'

const created: string[] = []

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  created.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('isCombinedWorkspacePath', () => {
  it('matches the root itself and its descendants only', () => {
    const root = '/example/.dsh/multi-workspaces'
    expect(isCombinedWorkspacePath(root, root)).toBe(true)
    expect(isCombinedWorkspacePath(join(root, 'alpha-beta'), root)).toBe(true)
    expect(isCombinedWorkspacePath(`${root}-sibling/alpha`, root)).toBe(false)
    expect(isCombinedWorkspacePath('/example/project', root)).toBe(false)
    expect(isCombinedWorkspacePath(undefined, root)).toBe(false)
    expect(isCombinedWorkspacePath('   ', root)).toBe(false)
  })

  it('matches both the configured and the real workspace root spelling', () => {
    const base = tempDir('mw-prompt-root-')
    const realRoot = join(base, 'real-workspaces')
    mkdirSync(join(realRoot, 'ws'), { recursive: true })
    const linkedRoot = join(base, 'linked-workspaces')
    symlinkSync(realRoot, linkedRoot, 'dir')

    expect(isCombinedWorkspacePath(join(realRoot, 'ws'), linkedRoot)).toBe(true)
    expect(isCombinedWorkspacePath(join(linkedRoot, 'ws'), realRoot)).toBe(true)
    expect(workspaceRootVariants(linkedRoot)).toContain(realpathSync(realRoot))
  })

  it('isInsideRoot normalizes redundant separators', () => {
    expect(isInsideRoot('/root/child/', ['/root'])).toBe(true)
    expect(isInsideRoot('/root', ['/root'])).toBe(true)
    expect(isInsideRoot('/root2', ['/root'])).toBe(false)
  })
})

describe('readWorkspaceMembers', () => {
  it('returns the recorded links', () => {
    const workspace = tempDir('mw-prompt-ws-')
    writeFileSync(
      join(workspace, MANIFEST_FILE),
      JSON.stringify({
        version: 1,
        links: [
          { name: 'alpha', target: '/tmp/alpha' },
          { name: 'beta', target: '/tmp/beta' },
        ],
      }),
    )
    expect(readWorkspaceMembers(workspace)).toEqual([
      { name: 'alpha', target: '/tmp/alpha' },
      { name: 'beta', target: '/tmp/beta' },
    ])
  })

  it('returns an empty list for a missing or malformed manifest', () => {
    expect(readWorkspaceMembers(tempDir('mw-prompt-empty-'))).toEqual([])
    const workspace = tempDir('mw-prompt-bad-')
    writeFileSync(join(workspace, MANIFEST_FILE), 'not-json')
    expect(readWorkspaceMembers(workspace)).toEqual([])
  })
})

describe('buildCombinedWorkspaceGuidance', () => {
  it('documents the worktree, search, sandbox, and Git differences', () => {
    const text = buildCombinedWorkspaceGuidance('/example/.dsh/multi-workspaces/alpha-beta', [
      { name: 'alpha', target: '/example/code/alpha' },
      { name: 'beta', target: '/example/code/beta' },
    ])
    expect(text).toContain('/example/.dsh/multi-workspaces/alpha-beta')
    expect(text).toContain('- alpha -> /example/code/alpha')
    expect(text).toContain('- beta -> /example/code/beta')
    expect(text).toContain('create_worktree')
    expect(text).toContain('not a git repository')
    expect(text).toContain('git -C <member> worktree add')
    expect(text).toContain('working_directory')
    expect(text).toContain('rg --follow')
    expect(text).toContain('danger-full-access')
    expect(text).toContain('.agents/worktrees/<name>')
    expect(text).toContain('never create worktrees as sibling directories')
    expect(text).toContain('Point grep/glob at a member path explicitly')
    expect(text).toContain('the workspace-write sandbox root is the Session')
    expect(text).toContain('suggest switching the Session access mode to Full access')
    expect(text).toContain('do not block, refuse, or stall the task')
    expect(text).toContain('clearly report which writes were skipped')
  })

  it('omits the member list when no manifest is available', () => {
    const text = buildCombinedWorkspaceGuidance('/example/.dsh/multi-workspaces/alpha')
    expect(text).not.toContain('Members (')
  })
})

describe('registerCombinedWorkspaceGuidance', () => {
  interface CapturedContext {
    name: string
    order: number
    required?: boolean
    text: (context: PromptAssembleContextLike) => string
  }

  function setup(options: {
    rootDir: string
    resolveCwd: (session: { header?: { cwd?: string } } | undefined) => string | undefined
    withOrderLookup?: boolean
  }): { provider: CapturedContext; injectedDependencies: string[] } {
    const contexts: CapturedContext[] = []
    const injected: string[][] = []
    const systemPrompt: SystemPromptLike = {
      context: definition => {
        contexts.push(definition)
        return () => {}
      },
      ...(options.withOrderLookup === false
        ? {}
        : { getContextOrder: () => 110 }),
    }
    registerCombinedWorkspaceGuidance(
      {
        inject: (dependencies, callback) => {
          injected.push([...dependencies])
          callback({ systemPrompt })
        },
      },
      options,
    )
    expect(contexts).toHaveLength(1)
    return { provider: contexts[0] as CapturedContext, injectedDependencies: injected[0] as string[] }
  }

  it('registers one required context after the sandbox policy', () => {
    const { provider, injectedDependencies } = setup({
      rootDir: '/root',
      resolveCwd: () => '/root/ws',
    })
    expect(injectedDependencies).toEqual(['systemPrompt'])
    expect(provider.name).toBe(GUIDANCE_CONTEXT_NAME)
    expect(provider.order).toBe(115)
    expect(provider.required).toBe(true)
  })

  it('returns guidance only inside the combined workspace root', () => {
    const { provider } = setup({
      rootDir: '/root',
      resolveCwd: session => session?.header?.cwd,
    })
    expect(provider.text({ agent: { session: { header: { cwd: '/root/ws' } } } })).toContain(
      '/root/ws',
    )
    expect(provider.text({ agent: { session: { header: { cwd: '/somewhere/else' } } } })).toBe('')
    expect(provider.text({})).toBe('')
  })

  it('prefers the effective directory over the recorded header cwd', () => {
    const { provider } = setup({
      rootDir: '/root',
      resolveCwd: session =>
        session?.header?.cwd === '/root/ws' ? '/root/ws/alpha' : session?.header?.cwd,
    })
    expect(provider.text({ agent: { session: { header: { cwd: '/root/ws' } } } })).toContain(
      '/root/ws/alpha',
    )
  })

  it('uses the fallback order when the service has no order lookup', () => {
    const { provider } = setup({
      rootDir: '/root',
      resolveCwd: () => undefined,
      withOrderLookup: false,
    })
    expect(provider.order).toBe(115)
  })
})
