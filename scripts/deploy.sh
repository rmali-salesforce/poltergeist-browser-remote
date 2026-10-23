#!/bin/sh
# Deploy the built dist/ artifacts to their live destinations.
# Invoked via `dotenv -- sh scripts/deploy.sh` so FF_* env vars are set.
# Shared by `npm run install:local` and `npm run watch`.
set -eu

if [ ! -d dist ]; then
  echo "error: dist/ not found. Run 'npm run build' first." >&2
  exit 1
fi

: "${FF_BRIDGE_PATH:?FF_BRIDGE_PATH is not set (check your .env)}"
: "${FF_NATIVE_MESSAGING_DIR:?FF_NATIVE_MESSAGING_DIR is not set (check your .env)}"
: "${FF_HAMMERSPOON_DIR:?FF_HAMMERSPOON_DIR is not set (check your .env)}"

# 1. Python native messaging host
mkdir -p "$(dirname "$FF_BRIDGE_PATH")"
cp dist/ff_bridge.py "$FF_BRIDGE_PATH"
chmod +x "$FF_BRIDGE_PATH"

# 2. Native messaging manifest
mkdir -p "$FF_NATIVE_MESSAGING_DIR"
cp dist/action_bridge.json "$FF_NATIVE_MESSAGING_DIR/"

# 3. Hammerspoon config (auto-reloaded by Hammerspoon's own pathwatcher).
#    Back up a pre-existing init.lua exactly once, so repeated watch rebuilds
#    don't spam backups.
mkdir -p "$FF_HAMMERSPOON_DIR"
if [ -f "$FF_HAMMERSPOON_DIR/init.lua" ] && [ ! -f "$FF_HAMMERSPOON_DIR/init.lua.bak" ]; then
  cp "$FF_HAMMERSPOON_DIR/init.lua" "$FF_HAMMERSPOON_DIR/init.lua.bak"
  echo "warning: backed up existing Hammerspoon config to $FF_HAMMERSPOON_DIR/init.lua.bak"
fi
cp dist/init.lua "$FF_HAMMERSPOON_DIR/init.lua"

echo "Deployed:"
echo "  ff_bridge.py       -> $FF_BRIDGE_PATH"
echo "  action_bridge.json -> $FF_NATIVE_MESSAGING_DIR/action_bridge.json"
echo "  init.lua           -> $FF_HAMMERSPOON_DIR/init.lua"
echo "(The extension in dist/extension/ is reloaded from Firefox's about:debugging.)"
