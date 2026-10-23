# Firefox Action Bridge & Google Meet Controller

A robust, background-capable bridge between macOS (via Hammerspoon) and Firefox. It allows you to send commands to specific Firefox profiles silently in the background without bringing the browser to the front.

Currently optimized for **Google Meet**, enabling global hotkeys for toggling your Microphone, Camera, and instantly focusing your active meeting window.

## Architecture

1. **Hammerspoon (Lua)**: Intercepts global keyboard shortcuts (e.g., F13, F14, F15) and sends a JSON payload to a local Unix socket.
2. **Native Messaging Host (Python)**: A lightweight background process spawned by Firefox that listens on `/tmp/firefox_<profile>.sock` and pipes commands into the browser.
3. **WebExtension (JavaScript)**: Receives the command, finds the active Google Meet tab, executes the DOM manipulation, and returns the result/status back up the chain for on-screen feedback.

## Prerequisites

* **macOS**
* [Hammerspoon](https://www.hammerspoon.org/) installed and running.
* **Python 3** installed (`/usr/bin/env python3`).
* **Node.js & npm** (for building and signing the extension).
* **Firefox** (Standard, Developer Edition, or Nightly).

## Configuration

All machine-specific paths live in a `.env` file at the project root. The build reads these values and substitutes them into the generated install files, so you never hand-edit paths.

1. Copy the template and fill in your values:
   ```bash
   cp example.env .env
   ```
2. Set the following in `.env`:

   | Variable | Description |
   |---|---|
   | `FF_BRIDGE_PATH` | Absolute path where the Python host will live, e.g. `/Users/YOUR_USERNAME/.local/bin/ff_bridge.py`. |
   | `FF_SOCKET_DIR` | Directory for the per-profile Unix sockets. Default `/tmp`. |
   | `FF_AMO_JWT_ISSUER` | Mozilla AMO API key issuer (only needed for signing). |
   | `FF_AMO_JWT_SECRET` | Mozilla AMO API key secret (only needed for signing). |

   `.env` is gitignored — keep your real AMO credentials out of version control.

## Build

Install dependencies once, then pick a build mode:

```bash
npm install
```

* **`npm run build`** — substitutes your `.env` values and stages everything into a `dist/` folder:
  ```
  dist/
  ├── extension/          # unpacked WebExtension (load via about:debugging)
  ├── ff_bridge.py        # native host, paths substituted, executable
  ├── action_bridge.json  # native messaging manifest, path substituted
  └── init.lua            # Hammerspoon config, socket dir substituted
  ```
* **`npm run build:bundle`** — runs `build`, then signs a permanent `.xpi` from `dist/extension/` via Mozilla's Unlisted channel (output in `web-ext-artifacts/`). Requires `FF_AMO_JWT_ISSUER`/`FF_AMO_JWT_SECRET`; get an API key from the [Mozilla Add-on Developer Hub](https://addons.mozilla.org/en-US/developers/addon/api/key/).

## Installation Guide

Run `npm run build` first — every step below installs files from `dist/`.

### Step 1: Install the Native Messaging Host

1. Create a local binaries directory if it doesn't exist:
   ```bash
   mkdir -p ~/.local/bin
   ```
2. Copy the generated Python bridge script to the location you set in `FF_BRIDGE_PATH` (it is already executable):
   ```bash
   cp dist/ff_bridge.py ~/.local/bin/ff_bridge.py
   ```

### Step 2: Register the Host with Firefox

1. Create the Mozilla Native Messaging directory:
   ```bash
   mkdir -p "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
   ```
2. Copy the generated manifest (its `"path"` already points at `FF_BRIDGE_PATH`):
   ```bash
   cp dist/action_bridge.json "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts/"
   ```

### Step 3: Install the Extension in Firefox

**For permanent installs** (standard Firefox), sign the extension first:

1. Run `npm run build:bundle` to produce a signed `.xpi` in `web-ext-artifacts/`.
2. Navigate to `about:addons`, click the gear icon (⚙️), and select **Install Add-on From File…**.
3. Select the generated `.xpi`.

**For development/debugging**, load it temporarily instead:

1. Navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `dist/extension/manifest.json`.

Then, in either case:

3. Click the Action Bridge icon on the toolbar, type your profile name (e.g., `work`, `customer`, `personal`), and click **Save Identity**.
4. Repeat for any other Firefox profiles you use.

### Step 4: Configure Hammerspoon

1. Copy the contents of the generated `dist/init.lua` into your `~/.hammerspoon/init.lua` file.
   *(Note: If you already use Hammerspoon, append the contents to your existing configuration).*
2. Reload your Hammerspoon configuration (Click the Hammerspoon menu bar icon ➔ **Reload Config**).

### Step 5: (Optional but Recommended) Enable Background Camera Toggles

By default, Firefox powers down webcam hardware if video is disabled for more than 3 seconds. To prevent background camera toggles from hanging on macOS security checks:

1. Open a new tab in Firefox and navigate to `about:config`.
2. Search for `media.getusermedia.camera.off_while_disabled.enabled`.
3. Double-click to set it to **`false`**.

## Automating Future Updates

When you add new actions or make changes to the JavaScript files inside `src/`:

1. Open `src/manifest.json` and bump the `"version"` number (e.g., from `1.0.0` to `1.0.1`). Mozilla requires a new version number for every signature.
2. Ensure your `.env` file has your valid Mozilla credentials.
3. Run `npm run build:bundle` again.
4. Drag and drop the newly generated `.xpi` into `about:addons` to instantly update your profiles.

## Usage

If you use Karabiner-Elements, map your desired physical keys (like Print Screen, Scroll Lock, Pause) to `F13`, `F14`, and `F15`.

* **`F13`**: Toggle Microphone (Works entirely in the background)
* **`F14`**: Toggle Camera (Works entirely in the background if Step 5 is completed)
* **`F15`**: Focus Active Meet Call (Finds the active call window across all profiles and brings it to the front of your screen)

You will see a Hammerspoon visual alert on your screen confirming the status of your action (e.g., `🎙️ Mic: ON (Unmuted)`).
