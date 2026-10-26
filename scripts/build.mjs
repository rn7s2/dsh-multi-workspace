#!/usr/bin/env node
/**
 * Build the three deployable artifacts of the bundle:
 *
 *  - `lib/index.js`      Host plugin (plain ESM, fully bundled, no dsh imports)
 *  - `lib/typert.host.js` Host Typert manifest consumed by `dsh-typert-loader`
 *  - `lib/client.js`     Web Client module in the module-loader factory format
 *
 * @module dsh-multi-workspace/scripts/build
 */
import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const lib = join(root, 'lib')
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

/** Modules the Web page's module table provides; the client bundle must not inline them. */
const CLIENT_EXTERNAL = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-ui-primitives',
  'zod',
]

const watch = process.argv.includes('--watch')

const shared = {
  bundle: true,
  sourcemap: false,
  logLevel: 'warning',
  target: ['node22'],
}

/**
 * Build the Host plugin entry.
 */
async function buildHost() {
  await build({
    ...shared,
    entryPoints: [join(root, 'src/host/index.ts')],
    outfile: join(lib, 'index.js'),
    format: 'esm',
    platform: 'node',
  })
}

/**
 * Build the Host Typert manifest (the loader imports its `TYPERT` export).
 */
async function buildTypert() {
  await build({
    ...shared,
    entryPoints: [join(root, 'src/host/typert.ts')],
    outfile: join(lib, 'typert.host.js'),
    format: 'esm',
    platform: 'node',
  })
}

/**
 * Build the browser module, then wrap it into the module-loader factory shape
 * (`window.__ModuleLoader__.load({ id, factory })`).
 */
async function buildClient() {
  const result = await build({
    ...shared,
    entryPoints: [join(root, 'src/client/index.ts')],
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: ['es2022'],
    external: CLIENT_EXTERNAL,
    jsx: 'automatic',
    write: false,
  })
  const body = result.outputFiles[0].text
  const indented = body
    .split('\n')
    .map(line => (line.length > 0 ? `    ${line}` : line))
    .join('\n')
  const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${indented}
    return module.exports;
  },
});
`
  const outfile = join(lib, 'client.js')
  await writeFile(outfile, wrapped, 'utf8')
}

await mkdir(lib, { recursive: true })
if (watch) {
  const { context } = await import('esbuild')
  const contexts = await Promise.all([
    context({
      ...shared,
      entryPoints: [join(root, 'src/host/index.ts')],
      outfile: join(lib, 'index.js'),
      format: 'esm',
      platform: 'node',
    }),
    context({
      ...shared,
      entryPoints: [join(root, 'src/host/typert.ts')],
      outfile: join(lib, 'typert.host.js'),
      format: 'esm',
      platform: 'node',
    }),
  ])
  for (const ctx of contexts) await ctx.watch()
  await buildClient()
  // eslint-disable-next-line no-console
  console.log('[dsh-multi-workspace] watching host artifacts; client rebuilt once')
} else {
  await Promise.all([buildHost(), buildTypert(), buildClient()])
  // eslint-disable-next-line no-console
  console.log('[dsh-multi-workspace] built lib/index.js, lib/typert.host.js, lib/client.js')
}
