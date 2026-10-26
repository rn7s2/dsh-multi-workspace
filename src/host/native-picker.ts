/**
 * Native macOS multi-folder picker.
 *
 * The panel is a scripted AppKit `NSOpenPanel` run by the system JXA host
 * (`osascript -l JavaScript`), with `allowsMultipleSelection` enabled. The
 * dialog is native OS chrome and runs modal on the host display; the picked
 * paths come back as one JSON array on stdout, and a cancel prints nothing.
 *
 * The script installs a standard Edit menu first: a native panel resolves
 * ⌘C/⌘V/⌘A/⌘X as main-menu key equivalents rather than as focused-field
 * behavior, so without that menu the panel's text fields (Go to Folder,
 * Search) cannot paste. The prompt arrives as argv, never as source.
 *
 * Only macOS is supported for now; other platforms reject with an actionable
 * message.
 *
 * @module dsh-multi-workspace/host/native-picker
 */
import { spawn } from 'node:child_process'

/** The AppKit panel source executed by `osascript -l JavaScript`. */
const MAC_PANEL = `
ObjC.import('AppKit');
function run(argv) {
  var app = $.NSApplication.sharedApplication;
  app.setActivationPolicy($.NSApplicationActivationPolicyAccessory);
  var mainMenu = $.NSMenu.alloc.init;
  mainMenu.addItem($.NSMenuItem.alloc.init);
  var editMenu = $.NSMenu.alloc.initWithTitle('Edit');
  var editItem = $.NSMenuItem.alloc.init;
  editItem.submenu = editMenu;
  mainMenu.addItem(editItem);
  editMenu.addItemWithTitleActionKeyEquivalent('Undo', 'undo:', 'z');
  editMenu.addItemWithTitleActionKeyEquivalent('Redo', 'redo:', 'Z');
  editMenu.addItemWithTitleActionKeyEquivalent('Cut', 'cut:', 'x');
  editMenu.addItemWithTitleActionKeyEquivalent('Copy', 'copy:', 'c');
  editMenu.addItemWithTitleActionKeyEquivalent('Paste', 'paste:', 'v');
  editMenu.addItemWithTitleActionKeyEquivalent('Select All', 'selectAll:', 'a');
  app.mainMenu = mainMenu;
  app.activateIgnoringOtherApps(true);
  var panel = $.NSOpenPanel.openPanel;
  panel.canChooseFiles = false;
  panel.canChooseDirectories = true;
  panel.canCreateDirectories = true;
  panel.allowsMultipleSelection = true;
  panel.message = argv[0];
  if (panel.runModal !== $.NSModalResponseOK) return '';
  var urls = panel.URLs;
  var paths = [];
  for (var i = 0; i < urls.count; i++) paths.push(ObjC.unwrap(urls.objectAtIndex(i).path));
  return JSON.stringify(paths);
}`

/** One completed native command. */
export interface NativeCommandResult {
  readonly stdout: string
  readonly stderr: string
}

/** Injectable command runner (tests provide a deterministic fake). */
export type NativeCommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<NativeCommandResult>

/** Picker dependencies, injectable for tests. */
export interface NativePickerOptions {
  /** Host platform; defaults to `process.platform`. */
  platform?: NodeJS.Platform
  /** Runner override; defaults to spawning the real command without a shell. */
  run?: NativeCommandRunner
  /** Test-only command name override (used by the dev E2E double); defaults to `osascript`. */
  command?: string
}

/**
 * Run one native command without a shell and collect its output.
 * @param command - executable name resolved through PATH.
 * @param args - argv (never interpolated into a shell string).
 * @returns stdout/stderr after a zero exit.
 */
export const runNativeCommand: NativeCommandRunner = async (command, args) =>
  await new Promise<NativeCommandResult>((resolve, reject) => {
    const child = spawn(command, [...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.once('error', error => {
      reject(error)
    })
    child.once('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      const detail = stderr.trim()
      reject(new Error(detail !== '' ? detail : `${command} exited with code ${String(code)}`))
    })
  })

/**
 * Parse the picker's stdout into absolute folder paths.
 * @param stdout - raw command output.
 * @returns the picked paths in panel order, or null when the operator cancelled.
 * @throws Error when the output is not a JSON array of non-empty strings.
 */
export function parsePickerOutput(stdout: string): string[] | null {
  const text = stdout.replace(/[\r\n]+$/, '').trim()
  if (text === '') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`native folder picker returned invalid output: ${text.slice(0, 200)}`, {
      cause: error,
    })
  }
  if (!Array.isArray(parsed)) {
    throw new Error('native folder picker returned a non-array selection')
  }
  const paths: string[] = []
  for (const value of parsed) {
    if (typeof value !== 'string' || value === '') {
      throw new Error('native folder picker returned a non-string path')
    }
    paths.push(value)
  }
  return paths
}

/**
 * Open the native macOS folder panel with multiple selection enabled.
 * @param message - prompt shown inside the panel.
 * @param options - platform/runner overrides.
 * @returns the picked absolute folder paths, or null when the operator cancels.
 * @throws Error on unsupported platforms or a failed chooser launch.
 */
export async function pickNativeDirectories(
  message: string,
  options: NativePickerOptions = {},
): Promise<string[] | null> {
  const platform = options.platform ?? process.platform
  if (platform !== 'darwin') {
    throw new Error(
      'The multi-folder picker is only supported on macOS for now; this host runs on ' + platform + '.',
    )
  }
  const run = options.run ?? runNativeCommand
  const command = options.command ?? 'osascript'
  const result = await run(command, ['-l', 'JavaScript', '-e', MAC_PANEL, message])
  return parsePickerOutput(result.stdout)
}
