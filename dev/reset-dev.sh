#!/usr/bin/env bash
# Remove the isolated development home (profile + workspaces + sessions).
set -euo pipefail
DEV_HOME="${DEV_HOME:-/tmp/dsh-mw-dev}"
echo "[dev] removing $DEV_HOME"
rm -rf "$DEV_HOME"
