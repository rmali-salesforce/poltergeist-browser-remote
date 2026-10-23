# AI Context & Architecture Notes

System context, architectural constraints, and design decisions for AI coding assistants working on `poltergeist-browser-remote`.

## System Overview

A 3-tier, bidirectional IPC system that lets macOS global hotkeys drive specific background tabs in multi-profile Firefox. First action pack targets Google Meet automation.

```
macOS (Hammerspoon/Lua)  ⇄  Unix Socket (Python host)  ⇄  Native Messaging stdio  ⇄  Firefox MV3 Extension (JS)
```

A command flows **down** (hotkey → action in a tab) and the result flows **back up** the same path for on-screen feedback.

## Where Things Live

| Tier | Path | Language | Runs on |
|---|---|---|---|
| Client | [install/hammerspoon/init.lua](install/hammerspoon/init.lua) | Lua | Hammerspoon |
| Router | [bin/poltergeist_bridge.py](bin/poltergeist_bridge.py) | Python 3 (stdlib only) | OS, spawned by Firefox |
| Executor (dispatcher) | [src/background.js](src/background.js) | JS (MV3) | Firefox |
| Executor (actions) | [src/actions/](src/actions/) — [meetActions.js](src/actions/meetActions.js), registered in [index.js](src/actions/index.js) | JS (MV3) | Firefox |
| Popup (profile identity) | [src/popup.js](src/popup.js) / [src/popup.html](src/popup.html) | JS | Firefox |
| Build/deploy | [scripts/deploy.sh](scripts/deploy.sh), [scripts/ensure-env.cjs](scripts/ensure-env.cjs) | sh / node | dev machine |

Install files in `install/` and `bin/` contain `__PGR_*__` placeholders that the build substitutes from `.env` into `dist/`. **Edit the sources, never `dist/`** (`dist/` is regenerated on every build).

## Commands

```bash
npm run build          # substitute .env → stage dist/ (no deploy, no signing)
npm run provision      # build, then deploy host + manifest + hammerspoon to .env paths
npm run watch          # rebuild + redeploy on changes to src/ bin/ install/
npm run build:bundle   # build, then sign a permanent .xpi (needs AMO creds in .env)
```

There is **no test suite and no linter**. Validate changes by loading `dist/extension` via `about:debugging` and watching the extension's Inspect console. Python: `python3 -c "import ast; ast.parse(open('bin/poltergeist_bridge.py').read())"` for a quick syntax check.

## IPC Contract

Hammerspoon sends JSON to `PGR_SOCKET_DIR/poltergeist_<profile>.sock`. The Python host injects a `req_id` (UUID), forwards to the extension over Native Messaging, and blocks on a `threading.Event()` until `background.js` replies with the matching `req_id`. Unknown actions resolve to `{ success: false, error: "ACTION_NOT_FOUND" }` from the dispatcher. Current actions: `meet_toggle_mic`, `meet_toggle_cam`, `meet_focus` (which returns `callCode` for Hammerspoon's window match).

Keep the request/response shape stable across all three tiers — a field added in `background.js` must be read in both the Python host and `init.lua`.

## Tier Constraints

### Hammerspoon — [init.lua](install/hammerspoon/init.lua)
- Intercepts F13–F15, polls `poltergeist_*.sock`, sends payloads via `nc -U`.
- ❌ Do **not** call `hs.application.get("Firefox"):activate()` — it yanks every profile's windows forward.
- ✅ Wait for `callCode` in the JSON response, then `hs.window:focus()` with a title string-match: `title:find(callCode, 1, true)`.

### Python Bridge — [poltergeist_bridge.py](bin/poltergeist_bridge.py)
- Translates Unix socket streams ⇄ Firefox's 4-byte length-prefixed Native Messaging frames.
- ❌ No third-party dependencies — **standard library only** (it runs via `/usr/bin/env python3`, unknown env).
- ✅ Clean up the socket file via `atexit`. Validate `profile` against `_SAFE_PROFILE_RE` before building a socket path (falls back to `default`).

### WebExtension — [src/](src/)
- `background.js` is a **pure dispatcher** (Command Pattern); all business logic lives in `src/actions/` and is statically mapped in [index.js](src/actions/index.js).
- ❌ No dynamic runtime imports (e.g. `` import(`./actions/${name}.js`) ``) — MV3 CSP forbids it.
- ✅ Register every new action statically at startup in [index.js](src/actions/index.js).

## Google Meet Gotchas — [meetActions.js](src/actions/meetActions.js)

When writing Meet actions, strictly follow these:

1. **No stale DOM.** Meet's Wiz framework detaches and replaces nodes on interaction. Do **not** cache `document.querySelector` results outside a polling loop — re-query every iteration of a state-verification loop.
2. **Camera needs OS focus.** Firefox blocks `getUserMedia()` in background tabs unless `media.getusermedia.camera.off_while_disabled.enabled = false` in `about:config`. Handle gracefully: if `before === after`, warn instead of erroring.
3. **Never touch `document.title`.** Don't prepend `[ACTIVE]`/emojis to help window-matching — Meet's SPA router clashes with it and it pollutes history. Return the room code already present in the title (e.g. `abc-defg-hij`) up the `req_id` route instead.
4. **Focus internally first.** Use `browser.tabs.update({ active: true })` and `browser.windows.update({ focused: true })` to prepare the tab inside Firefox, then hand OS-level focus back to Hammerspoon.

## Build & Config Notes

- `.env` at the project root holds all machine-specific paths and AMO signing creds; `example.env` is the template, `ensure-env.cjs` bootstraps it. `.env` is gitignored.
- `npm run build` uses `dotenv-cli` + `sed` to substitute `__PGR_*__` placeholders; `build:bundle` adds `web-ext sign` (Mozilla Unlisted channel).
- Bumping `src/manifest.json` `"version"` is **required** before each re-sign — Mozilla rejects duplicate versions.
