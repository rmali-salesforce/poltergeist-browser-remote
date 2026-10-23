#!/bin/sh
# Deploy the built dist/ artifacts to their live destinations.
# Invoked via `dotenv -- sh scripts/deploy.sh` so PGR_* env vars are set.
# Shared by `npm run install:local` and `npm run watch`.
set -eu

if [ ! -d dist ]; then
  echo "error: dist/ not found. Run 'npm run build' first." >&2
  exit 1
fi

: "${PGR_BRIDGE_PATH:?PGR_BRIDGE_PATH is not set (check your .env)}"
: "${PGR_NATIVE_MESSAGING_DIR:?PGR_NATIVE_MESSAGING_DIR is not set (check your .env)}"
: "${PGR_HAMMERSPOON_DIR:?PGR_HAMMERSPOON_DIR is not set (check your .env)}"

# 1. Python native messaging host
mkdir -p "$(dirname "$PGR_BRIDGE_PATH")"
cp dist/poltergeist_bridge.py "$PGR_BRIDGE_PATH"
chmod +x "$PGR_BRIDGE_PATH"

# 2. Native messaging manifest
mkdir -p "$PGR_NATIVE_MESSAGING_DIR"
cp dist/poltergeist_bridge.json "$PGR_NATIVE_MESSAGING_DIR/"

# 3. Hammerspoon config (auto-reloaded by Hammerspoon's own pathwatcher).
#    Back up a pre-existing init.lua exactly once, so repeated watch rebuilds
#    don't spam backups.
mkdir -p "$PGR_HAMMERSPOON_DIR"
if [ -f "$PGR_HAMMERSPOON_DIR/init.lua" ] && [ ! -f "$PGR_HAMMERSPOON_DIR/init.lua.bak" ]; then
  cp "$PGR_HAMMERSPOON_DIR/init.lua" "$PGR_HAMMERSPOON_DIR/init.lua.bak"
  echo "warning: backed up existing Hammerspoon config to $PGR_HAMMERSPOON_DIR/init.lua.bak"
fi
cp dist/init.lua "$PGR_HAMMERSPOON_DIR/init.lua"

echo "Deployed:"
echo "  poltergeist_bridge.py   -> $PGR_BRIDGE_PATH"
echo "  poltergeist_bridge.json -> $PGR_NATIVE_MESSAGING_DIR/poltergeist_bridge.json"
echo "  init.lua                -> $PGR_HAMMERSPOON_DIR/init.lua"
echo "(The extension in dist/extension/ is reloaded from Firefox's about:debugging.)"
