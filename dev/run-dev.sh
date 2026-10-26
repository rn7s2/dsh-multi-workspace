#!/usr/bin/env bash
# Run an isolated rc.3 dsh web instance that has this checkout installed as a
# bundle, for end-to-end development without touching the live profile.
#
#   dev/run-dev.sh            # default: /tmp/dsh-mw-dev, profile mwdev, port 3081
#   PORT=4000 dev/run-dev.sh
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${NODE_BIN:-node}"
DSH_CMD=()
if [ -n "${DSH_BIN:-}" ]; then
  DSH_CMD=("$NODE_BIN" "$DSH_BIN")
elif command -v dsh >/dev/null 2>&1; then
  DSH_CMD=(dsh)
else
  echo "Set DSH_BIN to the dsh CLI entry (…/@deepseek-ai/dsh/lib/bin.js) or put 'dsh' on PATH" >&2
  exit 1
fi
DEV_HOME="${DEV_HOME:-/tmp/dsh-mw-dev}"
PROFILE="${PROFILE:-mwdev}"
PORT="${PORT:-3081}"
DEFAULT_TEMPLATE="${DEFAULT_TEMPLATE:-web}"

export DSH_HOME="$DEV_HOME"
mkdir -p "$DEV_HOME"

# Native-panel test double. The plugin launches `osascript`; put our fake first
# on PATH so the dev E2E can drive the panel without clicking the macOS dialog.
# Set USE_REAL_PICKER=1 to exercise the real NSOpenPanel instead.
PICK_FILE="${DSH_MULTI_WORKSPACE_TEST_PICK_FILE:-/tmp/dsh-mw-pick.json}"
if [ "${USE_REAL_PICKER:-0}" != "1" ]; then
  export PATH="$REPO/dev/fake-bin:$PATH"
  export DSH_MULTI_WORKSPACE_TEST_PICK_FILE="$PICK_FILE"
  echo "[dev] native picker test double active; selection file: $PICK_FILE"
fi

echo "[dev] building plugin"
(cd "$REPO" && node scripts/build.mjs >/dev/null)

if [ ! -f "$DSH_HOME/profiles/$PROFILE/package.json" ]; then
  echo "[dev] creating profile $PROFILE from the shipped $DEFAULT_TEMPLATE template"
  "${DSH_CMD[@]}" --profile "$PROFILE" --from-default-profile "$DEFAULT_TEMPLATE" --dump-config >/dev/null
fi

echo "[dev] installing $REPO into profile $PROFILE"
"${DSH_CMD[@]}" plugin --profile "$PROFILE" add "$REPO"

echo "[dev] serving on port $PORT (DSH_HOME=$DSH_HOME)"
exec "${DSH_CMD[@]}" --profile "$PROFILE" --port "$PORT" --no-open
