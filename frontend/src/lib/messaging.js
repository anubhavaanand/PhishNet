/**
 * Chrome extension messaging layer for React popup & options page.
 *
 * Wraps chrome.runtime.sendMessage in Promise-returning helpers that
 * match the existing background service worker message contract.
 */

const api = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);

export async function sendMessage(message) {
  if (!api?.runtime?.sendMessage) {
    throw new Error('Extension runtime unavailable');
  }
  return api.runtime.sendMessage(message);
}

export async function getStatus() {
  try {
    return await sendMessage({ type: 'GET_STATUS' });
  } catch {
    return null;
  }
}

export async function getSettings() {
  try {
    const res = await sendMessage({ type: 'GET_SETTINGS' });
    return res;
  } catch {
    return null;
  }
}

export async function updateSettings(settings) {
  try {
    return await sendMessage({ type: 'UPDATE_SETTINGS', settings });
  } catch {
    return null;
  }
}

export async function addWhitelistEntry(entry) {
  try {
    return await sendMessage({ type: 'ADD_WHITELIST', entry });
  } catch {
    return null;
  }
}

export async function removeWhitelistEntry(entry) {
  try {
    return await sendMessage({ type: 'REMOVE_WHITELIST', entry });
  } catch {
    return null;
  }
}

export async function clearHistory() {
  try {
    return await sendMessage({ type: 'CLEAR_HISTORY' });
  } catch {
    return null;
  }
}

export async function scanCurrentTab() {
  try {
    return await sendMessage({ type: 'SCAN_CURRENT_TAB' });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function getLocalStorage(keys) {
  return new Promise((resolve) => {
    if (!api?.storage?.local) { resolve({}); return; }
    api.storage.local.get(keys, (data) => resolve(data));
  });
}

export function onSettingsUpdate(callback) {
  if (!api?.runtime?.onMessage) return () => {};
  const listener = (msg) => {
    if (msg?.type === 'SETTINGS_UPDATE') callback(msg.payload);
  };
  api.runtime.onMessage.addListener(listener);
  return () => api.runtime.onMessage.removeListener(listener);
}

export function onModelStatus(callback) {
  if (!api?.runtime?.onMessage) return () => {};
  const listener = (msg) => {
    if (msg?.type === 'MODEL_STATUS') callback(msg.payload);
  };
  api.runtime.onMessage.addListener(listener);
  return () => api.runtime.onMessage.removeListener(listener);
}
