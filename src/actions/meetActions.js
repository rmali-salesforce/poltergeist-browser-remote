/**
 * actions/meetActions.js
 * Production-ready Google Meet automation with live DOM polling and telemetry.
 */

const LOG_PREFIX = "[Meet Action]";

const Logger = {
  info: (msg, data = "") => console.log(`%c${LOG_PREFIX}%c ${msg}`, "color: #3b82f6; font-weight: bold;", "color: inherit;", data),
  success: (msg, data = "") => console.log(`%c${LOG_PREFIX} 🟢%c ${msg}`, "color: #10b981; font-weight: bold;", "color: inherit;", data),
  warn: (msg, data = "") => console.warn(`%c${LOG_PREFIX} 🟡%c ${msg}`, "color: #f59e0b; font-weight: bold;", "color: inherit;", data),
  error: (msg, err = "") => console.error(`%c${LOG_PREFIX} 🔴%c ${msg}`, "color: #ef4444; font-weight: bold;", "color: inherit;", err)
};

/**
 * Inspects all open tabs to find one inside an ongoing Google Meet call.
 */
async function resolveActiveCallTab() {
  const tabs = await browser.tabs.query({ url: "*://meet.google.com/*" });

  if (!tabs || tabs.length === 0) {
    Logger.info("No Google Meet tabs open in this profile.");
    return null;
  }

  for (const tab of tabs) {
    const match = tab.url.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
    if (!match) continue;

    const callCode = match[1];

    try {
      const [res] = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const hasLeaveBtn = !!document.querySelector(
            'button[aria-label*="Leave call" i], button[aria-label*="Quitter l\'appel" i], button[jsname="CQylAd"]'
          );
          const hasEnded = document.body.innerText.includes("You left the meeting") ||
                           !!document.querySelector('[data-call-ended="true"]');
          const isLobby = !!document.querySelector('button[aria-label*="Join now" i], button[aria-label*="Ask to join" i]');

          return {
            isInCall: hasLeaveBtn && !hasEnded,
            isLobby,
            hasEnded
          };
        }
      });

      const state = res?.result;
      if (state?.isInCall) {
        return { tab, callCode };
      }
    } catch (e) {
      Logger.warn(`Could not inspect tab ${tab.id} (${callCode}):`, e.message);
    }
  }

  Logger.warn("Google Meet tabs were found, but none are currently in an active call.");
  return null;
}

export const meetActions = [
  // -------------------------------------------------------------------------
  // ACTION: Toggle Microphone
  // -------------------------------------------------------------------------
  {
    name: "meet_toggle_mic",
    description: "Toggles microphone and verifies state change in live DOM",
    async execute(payload, context) {
      const active = await resolveActiveCallTab();
      if (!active) return { executed: false, reason: "NO_ACTIVE_CALL" };

      const { tab, callCode } = active;

      try {
        const [execution] = await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: async () => {
            // Helper: Always query the FRESH element from the live DOM
            const inspectMic = () => {
              const btn = document.querySelector('button[data-is-muted]')
                       || document.querySelector('button[aria-label*="microphone" i]')
                       || document.querySelector('button[aria-label*="⌘ + d" i]')
                       || document.querySelector('button[aria-label*="ctrl + d" i]');
              if (!btn) return { btn: null, status: "NOT_FOUND" };

              const mutedAttr = btn.getAttribute("data-is-muted")
                             || btn.closest("[data-is-muted]")?.getAttribute("data-is-muted")
                             || btn.querySelector("[data-is-muted]")?.getAttribute("data-is-muted");

              if (mutedAttr !== null && mutedAttr !== undefined) {
                return { btn, status: mutedAttr === "true" ? "MUTED" : "UNMUTED" };
              }

              const label = (btn.getAttribute("aria-label") || "").toLowerCase();
              if (label.includes("turn off") || label.includes("désactiver")) return { btn, status: "UNMUTED" };
              if (label.includes("turn on") || label.includes("activer")) return { btn, status: "MUTED" };
              return { btn, status: "UNKNOWN" };
            };

            const initial = inspectMic();
            if (!initial.btn) return { status: "BUTTON_NOT_FOUND" };

            const before = initial.status;
            const startTime = performance.now();

            // Click the button
            initial.btn.click();

            // Poll the LIVE DOM for the replacement node & updated state
            let after = before;
            for (let i = 0; i < 10; i++) {
              await new Promise((r) => setTimeout(r, 40));
              const current = inspectMic();
              if (current.status !== "UNKNOWN" && current.status !== "NOT_FOUND") {
                after = current.status;
                if (after !== before) break;
              }
            }

            return {
              status: "SUCCESS",
              changed: after !== before,
              before,
              after,
              durationMs: Math.round(performance.now() - startTime)
            };
          }
        });

        const result = execution?.result;
        if (result?.status === "SUCCESS") {
          if (result.changed) {
            Logger.success(`🎙️ Mic: ${result.before} ➔ ${result.after} (${result.durationMs}ms) | Room: [${callCode}]`);
          } else {
            Logger.warn(`🎙️ Mic: State remained ${result.before} (${result.durationMs}ms)`);
          }
        }
        return result;
      } catch (err) {
        Logger.error("Failed executing mic toggle:", err.message);
        return { executed: false, error: err.message };
      }
    }
  },

  // -------------------------------------------------------------------------
  // ACTION: Toggle Camera
  // -------------------------------------------------------------------------
  {
    name: "meet_toggle_cam",
    description: "Toggles camera and verifies state change in live DOM",
    async execute(payload, context) {
      const active = await resolveActiveCallTab();
      if (!active) return { executed: false, reason: "NO_ACTIVE_CALL" };

      const { tab, callCode } = active;

      try {
        const [execution] = await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: async () => {
            // Helper: Always query the FRESH element from the live DOM
            const inspectCam = () => {
              const btn = document.querySelector('button[aria-label*="camera" i]')
                       || document.querySelector('button[aria-label*="video" i]')
                       || document.querySelector('button[aria-label*="⌘ + e" i]')
                       || document.querySelector('button[aria-label*="ctrl + e" i]');
              if (!btn) return { btn: null, status: "NOT_FOUND" };

              const mutedAttr = btn.getAttribute("data-is-muted")
                             || btn.closest("[data-is-muted]")?.getAttribute("data-is-muted")
                             || btn.querySelector("[data-is-muted]")?.getAttribute("data-is-muted");

              if (mutedAttr !== null && mutedAttr !== undefined) {
                return { btn, status: mutedAttr === "true" ? "CAMERA_OFF" : "CAMERA_ON" };
              }

              const label = (btn.getAttribute("aria-label") || "").toLowerCase();
              if (label.includes("turn off") || label.includes("désactiver")) return { btn, status: "CAMERA_ON" };
              if (label.includes("turn on") || label.includes("activer")) return { btn, status: "CAMERA_OFF" };
              return { btn, status: "UNKNOWN" };
            };

            const initial = inspectCam();
            if (!initial.btn) return { status: "BUTTON_NOT_FOUND" };

            const before = initial.status;
            const startTime = performance.now();

            // Click the button
            initial.btn.click();

            // Poll the LIVE DOM for the replacement node & updated state
            let after = before;
            for (let i = 0; i < 10; i++) {
              await new Promise((r) => setTimeout(r, 40));
              const current = inspectCam();
              if (current.status !== "UNKNOWN" && current.status !== "NOT_FOUND") {
                after = current.status;
                if (after !== before) break;
              }
            }

            return {
              status: "SUCCESS",
              changed: after !== before,
              before,
              after,
              durationMs: Math.round(performance.now() - startTime)
            };
          }
        });

        const result = execution?.result;
        if (result?.status === "SUCCESS") {
          if (result.changed) {
            Logger.success(`📷 Cam: ${result.before} ➔ ${result.after} (${result.durationMs}ms) | Room: [${callCode}]`);
          } else {
            Logger.warn(`📷 Cam: State remained ${result.before} (${result.durationMs}ms)`);
          }
        }
        return result;
      } catch (err) {
        Logger.error("Failed executing cam toggle:", err.message);
        return { executed: false, error: err.message };
      }
    }
  },

  // -------------------------------------------------------------------------
  // ACTION: Focus Meet Tab
  // -------------------------------------------------------------------------
  {
    name: "meet_focus",
    description: "Switches to active Meet tab, focuses window internally, and returns room code",
    async execute(payload, context) {
      const active = await resolveActiveCallTab();
      if (!active) return { executed: false, reason: "NO_ACTIVE_CALL" };

      const { tab, callCode } = active;

      try {
        await browser.tabs.update(tab.id, { active: true });
        await browser.windows.update(tab.windowId, { focused: true });

        Logger.success(`🪟 Prepared Meet tab: [${callCode}]`);
        return {
          executed: true,
          callCode,
          windowId: tab.windowId,
          tabId: tab.id
        };
      } catch (err) {
        Logger.error("Failed preparing Meet tab:", err.message);
        return { executed: false, error: err.message };
      }
    }
  }
];
