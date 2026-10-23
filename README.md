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

## Installation Guide

### Step 1: Install the Native Messaging Host

Firefox requires a local executable Python script to handle the bridge communication.

1. Create a local binaries directory if it doesn't exist:
   ```bash
   mkdir -p ~/.local/bin
   ```
2. Copy the Python bridge script and make it executable:
   ```bash
   cp bin/ff_bridge.py ~/.local/bin/ff_action_bridge.py
   chmod +x ~/.local/bin/ff_action_bridge.py
   ```

### Step 2: Register the Host with Firefox

Firefox needs a manifest file to know the Python script is safe to execute.

1. Create the Mozilla Native Messaging directory:
   ```bash
   mkdir -p "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
   ```
2. Copy the configuration file:
   ```bash
   cp install/NativeMessagingHosts/action_bridge.json "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts/"
   ```
3. **Important:** Open the copied `action_bridge.json` and ensure the `"path"` exactly matches your Mac username (e.g., `/Users/YOUR_USERNAME/.local/bin/ff_action_bridge.py`).

### Step 3: Sign and Bundle the Extension

To install the extension permanently in standard Firefox, it must be signed via Mozilla's Unlisted Channel. 

1. Go to the [Mozilla Add-on Developer Hub](https://addons.mozilla.org/en-US/developers/addon/api/key/) and generate a new API key.
2. In your terminal, navigate to the root of this project and install the build dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root of the project to securely store your API keys (make sure `.env` is added to your `.gitignore` if you use version control):
   ```env
   FF_AMO_JWT_ISSUER=user:00000000:000
   FF_AMO_JWT_SECRET=azerty
   ```
4. Run the build script to automatically sign the extension:
   ```bash
   npm run build
   ```
   *This will generate a signed `.xpi` file inside a `web-ext-artifacts/` directory.*

### Step 4: Install the Extension in Firefox

1. Open your Firefox profile.
2. Navigate to `about:addons`.
3. Click the gear icon (⚙️) in the top-right corner and select **Install Add-on From File…**.
4. Select the `.xpi` file generated in Step 3.
5. Click the Action Bridge icon on the toolbar, type your profile name (e.g., `work`, `customer`, `personal`), and click **Save Identity**. 
6. Repeat this step for any other Firefox profiles you use.

### Step 5: Configure Hammerspoon

1. Copy the contents of `install/hammerspoon/init.lua` into your `~/.hammerspoon/init.lua` file.
   *(Note: If you already use Hammerspoon, append the contents to your existing configuration).*
2. Reload your Hammerspoon configuration (Click the Hammerspoon menu bar icon ➔ **Reload Config**).

### Step 6: (Optional but Recommended) Enable Background Camera Toggles

By default, Firefox powers down webcam hardware if video is disabled for more than 3 seconds. To prevent background camera toggles from hanging on macOS security checks:

1. Open a new tab in Firefox and navigate to `about:config`.
2. Search for `media.getusermedia.camera.off_while_disabled.enabled`.
3. Double-click to set it to **`false`**.

## Automating Future Updates

When you add new actions or make changes to the JavaScript files inside `src/`:

1. Open `src/manifest.json` and bump the `"version"` number (e.g., from `1.0.0` to `1.0.1`). Mozilla requires a new version number for every signature.
2. Ensure your `.env` file has your valid Mozilla credentials.
3. Run `npm run build` again.
4. Drag and drop the newly generated `.xpi` into `about:addons` to instantly update your profiles.

## Usage

If you use Karabiner-Elements, map your desired physical keys (like Print Screen, Scroll Lock, Pause) to `F13`, `F14`, and `F15`.

* **`F13`**: Toggle Microphone (Works entirely in the background)
* **`F14`**: Toggle Camera (Works entirely in the background if Step 6 is completed)
* **`F15`**: Focus Active Meet Call (Finds the active call window across all profiles and brings it to the front of your screen)

You will see a Hammerspoon visual alert on your screen confirming the status of your action (e.g., `🎙️ Mic: ON (Unmuted)`).
