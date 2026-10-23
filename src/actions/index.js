import { meetActions } from "./meetActions.js";

// Central registry table
const actionRegistry = new Map();

function register(action) {
  if (!action.name || typeof action.execute !== "function") {
    throw new Error(`[Registry] Invalid action definition: ${JSON.stringify(action)}`);
  }
  if (actionRegistry.has(action.name)) {
    console.warn(`[Registry] Overwriting duplicate action name: "${action.name}"`);
  }
  actionRegistry.set(action.name, action);
}

// Register all modular action sets
meetActions.forEach(register);

/**
 * Dispatches an inbound command to its registered handler.
 * @param {string} actionName - The action ID from Hammerspoon
 * @param {object} payload - Entire incoming JSON payload
 * @param {object} context - Execution context (profile, logging, etc.)
 */
export async function dispatchAction(actionName, payload, context) {
  const handler = actionRegistry.get(actionName);

  if (!handler) {
    console.warn(`[Dispatcher] No registered action matching: "${actionName}"`);
    return { success: false, error: "ACTION_NOT_FOUND" };
  }

  try {
    const result = await handler.execute(payload, context);
    return { success: true, result };
  } catch (error) {
    console.error(`[Dispatcher] Execution error on "${actionName}":`, error);
    return { success: false, error: error.message };
  }
}

export function listRegisteredActions() {
  return Array.from(actionRegistry.keys());
}
