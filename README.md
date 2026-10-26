# dsh-multi-workspace

Combine several folders into **one** DeepSeek Harness workspace.

Pick two or more folders and the plugin materializes one real workspace directory under
`~/.dsh/multi-workspaces/`, symlinks every picked folder into it, and registers the workspace
with the default name **`A, B and C`**. Pick a single folder and nothing is materialized: the
folder itself is opened directly, exactly like the stock picker.

![Multi-workspace in the DSH sidebar](docs/screenshot.png)

The screenshot shows three workspaces created by the plugin: a combined
`alpha, beta and gamma` workspace (hover card shows the real directory under
`~/.dsh/multi-workspaces/alpha-beta-gamma`), a direct single-folder workspace `alpha`, and the
default workspace.

## Behavior

| Selection | Result |
| --- | --- |
| 1 folder | The folder is registered directly as the workspace — original behavior, no new directory, no symlinks. |
| 2+ folders | A real directory `~/.dsh/multi-workspaces/<slug>` is created, each folder becomes a symlink inside it, and the Workspace is registered with the derived title. |

Default name and directory rules:

- **Workspace title**: folder names only (never path prefixes), joined in selection order with
  `, ` and a final ` and ` — `A`, `A and B`, `A, B and C`, … (English connectors).
- **Real directory name**: a lower-case ASCII slug of the folder names joined with `-`
  (`alpha-beta-gamma`), unique per creation with `-2`, `-3`, … suffixes. Selections without any
  ASCII folder name fall back to `workspace`.
- **Symlink names**: the source folder names, with case-insensitive duplicates suffixed `-2`,
  `-3`, … Both the symlinks and the title use basenames only.
- A hidden `.dsh-multi-workspace.json` manifest inside the combined directory records its
  version, creation time, title, and link targets.

The plugin never moves, copies, or deletes the source folders. Removing the workspace
registration in the DSH UI keeps both the source folders and the combined directory on disk.

## Requirements

- **macOS** — the picker is the native `NSOpenPanel` with multiple selection enabled. Other
  platforms are not supported yet and the picker reports an actionable error.
- DeepSeek Harness `0.2.1-rc.3` (web profile or desktop profile).
- Node.js 22+, pnpm 10+ for building the plugin.

## Install

The plugin is a bundle: one package that carries a Host half (Typert Remote methods and the
workspace materializer) and a Client half (occupants of the two directory-flow slots).

The built artifacts (`lib/`) are committed, so a profile can install the package straight from
this repository — no build step on the installing machine:

```bash
# Option A (recommended): install straight from the repository.
dsh plugin --profile <profile> add github:rn7s2/dsh-multi-workspace

# Option B: from a local checkout (development; rebuild after source changes).
git clone https://github.com/rn7s2/dsh-multi-workspace.git
cd dsh-multi-workspace
pnpm install
pnpm build
dsh plugin --profile <profile> add "$PWD"

# Restart the harness once so the Host rows load, e.g.
dsh web
```

Use the profile you actually run: `web` for `dsh web`, `desktop` for the desktop app. Restart the
application after installing (the bundle's Host rows are imported at boot).

> **Troubleshooting — the "Add workspace" button disappears:** the button is rendered by
> `ui-workspace` only while a directory-flow occupant is registered, so it disappears if the
> plugin's Client half fails to load. The common cause is an install without the committed
> `lib/` artifacts (an older tarball, or a checkout where `lib/` was deleted). Reinstall with the
> commands above and restart; verify the package directory contains `lib/index.js`,
> `lib/typert.host.js`, and `lib/client.js`.

Both workspace entry points now open the plugin's picker:

- the sidebar **Add workspace** action (folder-plus icon), and
- the **Choose workspace** control above the prompt box → **Add workspace…**.

Both are owned by `ui-workspace`; the plugin replaces the picking *interaction* behind them by
occupying the two directory-flow holes, so the shipped add buttons and the rest of the workspace
UI (session lists, switching, rename, delete, drag-ordering) stay intact.

### Configuration

The combined-workspace root defaults to `<dsh home>/multi-workspaces`
(`$DSH_HOME/multi-workspaces`, otherwise `~/.dsh/multi-workspaces`). A composing row may set an
absolute override:

```yaml
- id: multi-workspace
  name: dsh-multi-workspace
  config:
    rootDir: /Users/me/Combined Workspaces
```

## How it works

```
src/
  shared/     wire contract, Remote spec, shared naming rules, vendored Remote-info helper
  host/       plain-ESM Cordis plugin (no dsh imports), native macOS picker, materializer
  client/     module-loader Client plugin: mounts Remote contribution, occupies both holes
cordis.patch.yml   bundle patch: disables the shipped adaptive picker row, inserts the
                   host-only native backend and this plugin
scripts/build.mjs  esbuild build for lib/index.js, lib/typert.host.js, lib/client.js
dev/               isolated dev instance + native-panel test double
test/              vitest unit and temp-directory integration tests
```

- **Host half** (`src/host/index.ts`): registers a `multiWorkspace` service through
  `ctx.provide()`, publishes a hand-written Typert manifest (`./typert`) that
  `dsh-typert-loader` registers automatically, and implements two Remote methods:
  - `multiWorkspace/pick(message)` — runs the scripted AppKit `NSOpenPanel` through
    `osascript -l JavaScript` with `allowsMultipleSelection = true` and returns the picked
    absolute paths, or `null` on cancel;
  - `multiWorkspace/create({ paths, title? })` — validates the selection, materializes the real
    directory + symlinks + manifest, then registers the durable Workspace via
    `ctx.workspaceRegistry.create(dir, title)` (rolling the directory back if registration
    fails).
- **Client half** (`src/client/index.ts`): awaits `ctx.remote.$mount(...)` for a hand-written
  Remote contribution, registers the picker prompt dictionary, and fills
  `conversation.hero.workspace.directoryFlow` and `sidebar.workspaces.directoryFlow` with one
  renderless flow occupant. On each `open` it runs `pick`, then either adopts the single folder
  directly (`onPicked`) or calls `create` and adopts the combined directory.
- The Host half is dependency-free so the profile-linked package can run without resolving any
  `@deepseek-ai/*` package from its own `node_modules`; the Typert artifacts are hand-written in
  the generated shape (the generator is a build-time tool of the dsh repository), and
  `src/shared/remote-info.ts` vendors the protocol's small lazy info factory (MIT).

## Development

```bash
pnpm run typecheck   # tsc --noEmit
pnpm run test        # vitest unit/integration tests
pnpm run build       # esbuild artifacts into lib/
```

`lib/` is committed on purpose (GitHub installs cannot run a build), so run `pnpm run build` and
commit the regenerated `lib/` together with every source change.

An isolated end-to-end instance (separate `DSH_HOME`, profile `mwdev`, port 3081) can be started
with:

```bash
# DSH_BIN points at the dsh CLI entry, or have `dsh` on PATH.
DSH_BIN="$(npm root -g)/@deepseek-ai/dsh/lib/bin.js" dev/run-dev.sh
```

Because the native panel is OS chrome that browser automation cannot click, the dev instance puts
a small `osascript` test double first on `PATH`: when the plugin's `NSOpenPanel` script is
launched, the double prints the JSON selection in
`$DSH_MULTI_WORKSPACE_TEST_PICK_FILE` (default `/tmp/dsh-mw-pick.json`; an empty file means
"cancelled") instead of opening the dialog. Everything else — Remote calls, materialization,
workspace registration, sidebar updates — is the production path. Set `USE_REAL_PICKER=1` to
exercise the real panel.

## Known limitations

- **macOS only** for now; the picker rejects on other platforms.
- The native panel cannot be driven by the browser-automation loop, so the dev E2E double above
  is used for the automated flow tests; the real panel is verified manually.
- Each combined workspace holds absolute symlinks to the source folders; moving a source folder
  breaks that link (the workspace title and other links stay valid).
- The plugin does not manage the combined directory's lifecycle — deleting the workspace
  registration keeps the directory, and removing the directory is a manual operation.

## License

MIT. The vendored `src/shared/remote-info.ts` helper is adapted from
`@deepseek-ai/dsh-typert-protocol` (MIT, © DeepSeek).
