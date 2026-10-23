# Poltergeist Browser Remote

A robust, background-capable remote control between macOS (via Hammerspoon) and your browser. It lets you send commands to specific browser profiles silently in the background, without bringing the browser to the front — as if an invisible hand were operating the tab.

The action layer is extensible: each capability is a self-contained action, statically registered at startup. The first action pack ships with **Google Meet** support — global hotkeys for toggling your Microphone, Camera, and instantly focusing your active meeting window — but new action packs can be added for any site.

The browser-side piece is the **Remote Haunt** WebExtension.

## Architecture

1. **Hammerspoon (Lua)**: Intercepts global keyboard shortcuts (e.g., F13, F14, F15) and sends a JSON payload to a local Unix socket.
2. **Native Messaging Host (Python)**: A lightweight background process (the Poltergeist bridge) spawned by the browser that listens on `/tmp/poltergeist_<profile>.sock` and pipes commands into the browser.
3. **WebExtension (JavaScript)**: The **Remote Haunt** extension receives the command, finds the target tab, executes the DOM manipulation, and returns the result/status back up the chain for on-screen feedback.

## Prerequisites

* **macOS**
* [Hammerspoon](https://www.hammerspoon.org/) installed and running.
* **Python 3** installed (`/usr/bin/env python3`).
* **Node.js & npm** (for building and signing the extension).
* **Firefox** (Standard, Developer Edition, or Nightly).

## Usage

If you use Karabiner-Elements, map your desired physical keys (like Print Screen, Scroll Lock, Pause) to `F13`, `F14`, and `F15`.

* **`F13`**: Toggle Microphone (works entirely in the background).
* **`F14`**: Toggle Camera (works when the window is active).
* **`F15`**: Focus Active Meet Call (finds the active call window across all profiles and brings it to the front of your screen).

You will see a Hammerspoon visual alert on your screen confirming the status of your action (e.g., `🎙️ Mic: ON (Unmuted)`).

## Installation

Install dependencies once:

```bash
npm install
```

Then follow the four steps below. Steps 1–2 are scripted by `npm run provision`; steps 3–4 are the browser-side parts that can't be automated.

### 1. Configure your paths

All machine-specific paths live in a `.env` file at the project root. The build reads these values and substitutes them into the generated install files, so you never hand-edit paths.

```bash
npm run provision
```

On the first run this creates `.env` from `example.env` and stops so you can fill in your paths. Edit `.env`:

| Variable | Description |
|---|---|
| `PGR_BRIDGE_PATH` | Absolute path where the Python host will be installed, e.g. `/Users/YOU/.local/bin/poltergeist_bridge.py`. |
| `PGR_SOCKET_DIR` | Directory for the per-profile Unix sockets. Default `/tmp`. |
| `PGR_NATIVE_MESSAGING_DIR` | Where Firefox looks for Native Messaging manifests, e.g. `/Users/YOU/Library/Application Support/Mozilla/NativeMessagingHosts`. |
| `PGR_HAMMERSPOON_DIR` | Your Hammerspoon config directory, e.g. `/Users/YOU/.hammerspoon`. |
| `PGR_AMO_JWT_ISSUER` | Mozilla AMO API key issuer (only needed to sign the extension). |
| `PGR_AMO_JWT_SECRET` | Mozilla AMO API key secret (only needed to sign the extension). |

`.env` is gitignored — keep your real AMO credentials out of version control.

### 2. Provision the machine

Run the same command again:

```bash
npm run provision
```

This builds everything into `dist/` and deploys the three OS-side pieces to the destinations in your `.env`:

* the Python native host → `PGR_BRIDGE_PATH`
* the Native Messaging manifest → `PGR_NATIVE_MESSAGING_DIR`
* the Hammerspoon config → `PGR_HAMMERSPOON_DIR/init.lua`

An existing `init.lua` is backed up to `init.lua.bak` on first run. Hammerspoon auto-reloads the config; if it doesn't, click the Hammerspoon menu bar icon ➔ **Reload Config**.

### 3. Install the extension in Firefox

**For a permanent install**, sign the extension (requires AMO credentials in `.env` — get an API key from the [Mozilla Add-on Developer Hub](https://addons.mozilla.org/en-US/developers/addon/api/key/)):

```bash
npm run build:bundle
```

Then navigate to `about:addons`, click the gear icon (⚙️) ➔ **Install Add-on From File…**, and select the `.xpi` from `web-ext-artifacts/`.

**For a temporary install** (development/debugging), skip signing: navigate to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**, and select `dist/extension/manifest.json`.

### 4. Set up the extension

1. Click the Remote Haunt icon on the toolbar.
2. Type your profile name (e.g., `work`, `customer`, `personal`) and click **Save Identity**. This name must match the socket the Hammerspoon script talks to (`poltergeist_<profile>.sock`).
3. Repeat for any other Firefox profiles you use.

## Troubleshooting

Work up the pipeline, tier by tier, to find where a command stops.

* **Hammerspoon receives the key.** Open the Hammerspoon Console (menu bar icon ➔ **Console**). Pressing `F13`/`F14`/`F15` should log activity. If nothing appears, the physical key isn't mapping to F13–F15 (check Karabiner-Elements).
* **The socket exists.** With Firefox running and the extension loaded, the native host should create a socket per profile:
  ```bash
  ls -l /tmp/poltergeist_*.sock
  ```
  No socket means the native host never started — recheck steps 2 and 3, and that the profile identity (step 4) is saved.
* **The native host is reachable.** Send a raw action to a socket and watch for a JSON reply (this is exactly what Hammerspoon does):
  ```bash
  echo '{"action":"meet_toggle_mic"}' | nc -U -w 2 /tmp/poltergeist_work.sock
  ```
  Any reply means the socket → host → extension round-trip works; an unknown action returns `{"success":false,"error":"ACTION_NOT_FOUND"}`, which is still a valid liveness check.
* **The extension is running.** Go to `about:debugging#/runtime/this-firefox`, find **Remote Haunt**, and click **Inspect** to open its console. Errors from the native host or actions surface here. If you changed extension code, click **Reload** (temporary installs) or reinstall the signed `.xpi`.

## Development

### Build modes

* **`npm run build`** — substitutes your `.env` values and stages everything into `dist/`:
  ```
  dist/
  ├── extension/               # unpacked Remote Haunt WebExtension (load via about:debugging)
  ├── poltergeist_bridge.py    # native host, paths substituted, executable
  ├── poltergeist_bridge.json  # native messaging manifest, path substituted
  └── init.lua                 # Hammerspoon config, socket dir substituted
  ```
* **`npm run build:bundle`** — runs `build`, then signs a permanent `.xpi` from `dist/extension/` via Mozilla's Unlisted channel (output in `web-ext-artifacts/`). Requires `PGR_AMO_JWT_ISSUER`/`PGR_AMO_JWT_SECRET`.
* **`npm run provision`** — runs `build`, then deploys the native host, manifest, and Hammerspoon config to the destinations in your `.env` (the scripted part of [Installation](#installation)).

### Watch mode

```bash
npm run watch
```

Watches `src/`, `bin/`, and `install/` and, on every change, rebuilds `dist/` and redeploys the native host, Native Messaging manifest, and Hammerspoon config. No `.xpi` is produced. Hammerspoon auto-reloads its config on each deploy; reload the extension itself from `about:debugging`. Requires a configured `.env`.

### Manual install

Prefer to install by hand, or want to understand what `provision` does? Run `npm run build` first, then copy the generated artifacts from `dist/` yourself:

```bash
# 1. Native messaging host
mkdir -p "$(dirname "$PGR_BRIDGE_PATH")"
cp dist/poltergeist_bridge.py "$PGR_BRIDGE_PATH"   # already executable

# 2. Native messaging manifest (its "path" already points at PGR_BRIDGE_PATH)
mkdir -p "$PGR_NATIVE_MESSAGING_DIR"
cp dist/poltergeist_bridge.json "$PGR_NATIVE_MESSAGING_DIR/"

# 3. Hammerspoon config (append to an existing init.lua if you already have one)
cp dist/init.lua "$PGR_HAMMERSPOON_DIR/init.lua"
```

Then do the browser-side parts — [install the extension](#3-install-the-extension-in-firefox) and [set up the identity](#4-set-up-the-extension).

### Releasing an updated extension

When you change the JavaScript in `src/`, Mozilla requires a fresh version number to re-sign:

1. Bump `"version"` in `src/manifest.json` (e.g., `1.0.0` → `1.0.1`).
2. Make sure `.env` has valid AMO credentials.
3. Run `npm run build:bundle`.
4. Drag the new `.xpi` into `about:addons` to update your profiles.
