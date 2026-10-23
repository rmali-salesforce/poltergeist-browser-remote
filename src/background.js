import { dispatchAction, listRegisteredActions } from "./actions/index.js";

let currentProfile = "unconfigured";
let nativePort = null;

function connectNativeHost() {
  nativePort = browser.runtime.connectNative("poltergeist_bridge");

  nativePort.onMessage.addListener(async (message) => {
    if (!message || !message.action) return;

    const context = {
      profile: currentProfile,
      timestamp: Date.now()
    };

    console.log(`[Bridge Dispatch] Action: "${message.action}" on profile [${currentProfile}]`);
    const dispatchResult = await dispatchAction(message.action, message, context);

    // Return response back to Python native host
    if (message.req_id) {
      nativePort.postMessage({
        type: "response",
        req_id: message.req_id,
        payload: dispatchResult
      });
    }
  });

  nativePort.onDisconnect.addListener((p) => {
    if (p.error) {
      console.error("[Bridge] Native port disconnected:", p.error.message);
    } else {
      console.log("[Bridge] Native port disconnected.");
    }
    nativePort = null;
  });

  nativePort.postMessage({ type: "register", profile: currentProfile });
}

async function init() {
  const data = await browser.storage.local.get("profileName");
  if (data.profileName) {
    currentProfile = data.profileName;
  }

  console.log(`[Bridge Background] Online. Profile: "${currentProfile}"`);
  console.log(`[Bridge Background] Registered actions:`, listRegisteredActions());

  connectNativeHost();
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.profileName) {
    currentProfile = changes.profileName.newValue;
    console.log(`[Bridge Background] Profile changed to: "${currentProfile}"`);
    if (nativePort) {
      nativePort.postMessage({ type: "register", profile: currentProfile });
    }
  }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATUS") {
    sendResponse({
      status: nativePort ? "Connected to Host" : "Disconnected",
      profile: currentProfile,
      actions: listRegisteredActions(),
      timestamp: new Date().toLocaleTimeString()
    });
  }
});

init();