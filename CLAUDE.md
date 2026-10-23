# AI Context & Architecture Notes

This document provides system context, architectural constraints, and design decisions for AI coding assistants working on the `ff-action-bridge` project.

## System Overview
This project is a 3-tier, bidirectional IPC system allowing macOS global hotkeys to interact with specific background tabs in multi-profile Firefox environments, specifically optimized for Google Meet automation.

**The pipeline:**
`macOS (Hammerspoon/Lua)` ⇄ `Unix Socket (Python)` ⇄ `Firefox Native Messaging Host (stdio)` ⇄ `Firefox MV3 Extension (JS)`

## Directory Structure
* `src/`: The Firefox WebExtension (Manifest V3). Must be bundled into a `.xpi`.
* `bin/`: The Python Native Messaging Host (`ff_bridge.py`). Runs locally on the OS.
* `install/`: Configurations for Mozilla NativeMessaging registry and Hammerspoon (`init.lua`).

## 1. Hammerspoon (The Client)
* **Location:** `install/hammerspoon/init.lua`
* **Role:** Intercepts hardware keys (F13-F15), polls available Unix sockets (`/tmp/firefox_*.sock`), and sends JSON payloads via `nc -U`.
* **Constraint - Window Focusing:** Do **NOT** use `hs.application.get("Firefox"):activate()`. This pulls all windows across all profiles to the front. Instead, the Lua script waits for a `callCode` in the JSON response and strictly uses `hs.window:focus()` with a string-match on the window title (`title:find(callCode, 1, true)`).

## 2. Python Bridge (The Router)
* **Location:** `bin/ff_bridge.py`
* **Role:** Translates Unix Socket streams into Firefox's 4-byte length-prefixed Native Messaging format.
* **Core Logic (Two-Way IPC):** Because Native Messaging is asynchronous but `nc` expects a synchronous response, the Python script injects a `req_id` (UUID) into the payload. It uses `threading.Event()` to suspend the socket handler until `background.js` returns the payload with the matching `req_id`.
* **Constraint:** Must remain standard library only (no `pip install` dependencies). Must handle socket cleanup via `atexit`.

## 3. WebExtension (The Executor)
* **Location:** `src/`
* **Role:** Executes DOM scripts in background tabs based on inbound actions.
* **Architecture:** Uses the Command Pattern. `background.js` acts as a pure dispatcher. All business logic lives in `src/actions/` and is statically registered in `index.js`.
* **Constraint - MV3 & CSP:** Do **NOT** attempt dynamic runtime imports (e.g., `import(./actions/${name}.js)`). Manifest V3 CSP strictly forbids this. All actions must be statically imported and mapped at startup.

## Critical Quirks & "Gotchas" (Google Meet)

If writing new actions for `src/actions/meetActions.js`, strictly adhere to these rules:

1. **No Stale DOM Elements:** Google Meet's UI framework (Wiz) aggressively detaches and replaces DOM elements upon interaction. **Do not cache `document.querySelector` results outside of polling loops.** Re-query the DOM on every iteration of a state-verification loop.
2. **Camera Constraints:** Firefox blocks background tabs from accessing `getUserMedia()` without active OS window focus. Camera toggles from the background will fail unless the user sets `media.getusermedia.camera.off_while_disabled.enabled = false` in `about:config`. Handle this gracefully in code by checking if `before === after` and issuing a warning.
3. **No Title Manipulation:** Do not prepend `[ACTIVE]` or other emojis to `document.title` to help Hammerspoon find the window. Meet's internal SPA router will clash with it, and it permanently pollutes the user's history/tabs. Instead, return the room code natively found in the title (e.g., `abc-defg-hij`) back to Hammerspoon via the `req_id` IPC route.
4. **Internal Focus:** Use `browser.tabs.update({ active: true })` and `browser.windows.update({ focused: true })` to prepare the tab *internally* in Firefox before returning control to Hammerspoon for the OS-level focus.

## Build Process
* `npm run build` leverages `dotenv-cli` and `web-ext sign`.
* It expects `FF_AMO_JWT_ISSUER` and `FF_AMO_JWT_SECRET` in a `.env` file to sign via Mozilla's Unlisted channel.