/**
 * PhishNet Background Service Worker
 * Handles model loading, message routing, and inference coordination
 */

// State
let offscreenDocumentCreated = false;
let modelStatus = 'loading'; // 'loading' | 'ready' | 'error'
let modelLoadProgress = 0;
let settings = {
  autoScan: true,
  sensitivityThreshold: 0.7,
  highlightLinks: true,
  showTooltip: true
};

/**
 * Initialize background service worker
 */
async function init() {
  console.log('[PhishNet] Background service worker starting');

  // Load settings from storage
  await loadSettings();

  // Create offscreen document for model inference
  await createOffscreenDocument();

  // Set up message listeners
  setupMessageListeners();

  // Notify all content scripts of model status
  broadcastModelStatus();
}

/**
 * Load settings from chrome.storage.sync
 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([
      'autoScan',
      'sensitivityThreshold',
      'highlightLinks',
      'showTooltip'
    ], (result) => {
      settings = {
        autoScan: result.autoScan ?? true,
        sensitivityThreshold: result.sensitivityThreshold ?? 0.7,
        highlightLinks: result.highlightLinks ?? true,
        showTooltip: result.showTooltip ?? true
      };
      resolve();
    });
  });
}

/**
 * Save settings to chrome.storage.sync
 */
async function saveSettings(newSettings) {
  settings = { ...settings, ...newSettings };
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}

/**
 * Create offscreen document for model inference
 */
async function createOffscreenDocument() {
  if (offscreenDocumentCreated) return;

  try {
    // Check if offscreen document already exists
    const clients = await self.clients.matchAll();
    const existing = clients.find(c => c.url.includes('offscreen.html'));

    if (existing) {
      offscreenDocumentCreated = true;
      console.log('[PhishNet] Offscreen document already exists');
      return;
    }

    // Create new offscreen document
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('public/offscreen.html'),
      reasons: ['LOCAL_STORAGE', 'WORKERS'],
      justification: 'Run Transformers.js model inference in isolated context'
    });

    offscreenDocumentCreated = true;
    console.log('[PhishNet] Offscreen document created');

    // Wait for offscreen to signal readiness
    await waitForOffscreenReady();

  } catch (error) {
    console.error('[PhishNet] Failed to create offscreen document:', error);
    modelStatus = 'error';
    broadcastModelStatus({ error: error.message });
  }
}

/**
 * Wait for offscreen document to signal it's ready
 */
function waitForOffscreenReady() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Offscreen document readiness timeout'));
    }, 30000);

    const listener = (message) => {
      if (message.type === 'OFFSCREEN_READY') {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        resolve();
      } else if (message.type === 'OFFSCREEN_ERROR') {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        reject(new Error(message.error));
      } else if (message.type === 'MODEL_LOAD_PROGRESS') {
        modelLoadProgress = message.progress;
        broadcastModelStatus({ progress: message.progress });
      }
    };

    chrome.runtime.onMessage.addListener(listener);
  });
}

/**
 * Set up message listeners
 */
function setupMessageListeners() {
  // From content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleContentScriptMessage(message, sender, sendResponse);
    return true; // Async response
  });

  // From popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handlePopupMessage(message, sender, sendResponse);
    return true;
  });

  // From offscreen document
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleOffscreenMessage(message, sender, sendResponse);
    return true;
  });
}

/**
 * Handle messages from content script
 */
async function handleContentScriptMessage(message, sender, sendResponse) {
  switch (message.type) {
    case 'CONTENT_READY':
      // Content script loaded, send current model status
      sendResponse({ modelStatus, settings });
      break;

    case 'SCAN_EMAIL':
      if (modelStatus !== 'ready') {
        sendResponse({ success: false, error: 'Model not ready' });
        return;
      }

      try {
        const result = await runInference(message.payload);
        sendResponse({ success: true, result });
      } catch (error) {
        console.error('[PhishNet] Inference error:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;

    case 'GET_SETTINGS':
      sendResponse(settings);
      break;

    case 'GET_MODEL_STATUS':
      sendResponse({ status: modelStatus, progress: modelLoadProgress });
      break;
  }
}

/**
 * Handle messages from popup
 */
async function handlePopupMessage(message, sender, sendResponse) {
  switch (message.type) {
    case 'GET_STATUS':
      sendResponse({ modelStatus, progress: modelLoadProgress, settings });
      break;

    case 'GET_SETTINGS':
      sendResponse(settings);
      break;

    case 'UPDATE_SETTINGS':
      await saveSettings(message.settings);
      // Broadcast to all content scripts
      broadcastSettingsUpdate();
      sendResponse({ success: true });
      break;

    case 'SCAN_CURRENT_TAB':
      // Trigger scan on active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'SCAN_CURRENT_EMAIL' }, (response) => {
          sendResponse(response || { success: false, error: 'No content script' });
        });
      } else {
        sendResponse({ success: false, error: 'No active tab' });
      }
      break;

    case 'RELOAD_MODEL':
      modelStatus = 'loading';
      broadcastModelStatus();
      await createOffscreenDocument();
      sendResponse({ success: modelStatus === 'ready' });
      break;
  }
}

/**
 * Handle messages from offscreen document
 */
function handleOffscreenMessage(message, sender, sendResponse) {
  switch (message.type) {
    case 'OFFSCREEN_READY':
      modelStatus = 'ready';
      broadcastModelStatus();
      sendResponse({ success: true });
      break;

    case 'OFFSCREEN_ERROR':
      modelStatus = 'error';
      broadcastModelStatus({ error: message.error });
      sendResponse({ success: true });
      break;

    case 'MODEL_LOAD_PROGRESS':
      modelLoadProgress = message.progress;
      broadcastModelStatus({ progress: message.progress });
      sendResponse({ success: true });
      break;

    case 'INFERENCE_RESULT':
      // Forward result back to content script (handled via pending callbacks)
      if (pendingInferenceCallbacks.has(message.requestId)) {
        const { resolve } = pendingInferenceCallbacks.get(message.requestId);
        pendingInferenceCallbacks.delete(message.requestId);
        resolve(message.result);
      }
      sendResponse({ success: true });
      break;

    case 'INFERENCE_ERROR':
      if (pendingInferenceCallbacks.has(message.requestId)) {
        const { reject } = pendingInferenceCallbacks.get(message.requestId);
        pendingInferenceCallbacks.delete(message.requestId);
        reject(new Error(message.error));
      }
      sendResponse({ success: true });
      break;
  }
}

// Pending inference callbacks
const pendingInferenceCallbacks = new Map();

/**
 * Run inference via offscreen document
 */
function runInference(emailData) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();

    pendingInferenceCallbacks.set(requestId, { resolve, reject });

    // Send to offscreen document
    chrome.runtime.sendMessage({
      type: 'RUN_INFERENCE',
      requestId,
      payload: emailData,
      settings
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (pendingInferenceCallbacks.has(requestId)) {
        pendingInferenceCallbacks.delete(requestId);
        reject(new Error('Inference timeout'));
      }
    }, 10000);
  });
}

/**
 * Broadcast model status to all content scripts
 */
function broadcastModelStatus(extra = {}) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'MODEL_STATUS',
        payload: { status: modelStatus, progress: modelLoadProgress, ...extra }
      }).catch(() => {}); // Ignore errors for tabs without content script
    });
  });
}

/**
 * Broadcast settings update to all content scripts
 */
function broadcastSettingsUpdate() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SETTINGS_UPDATE',
        payload: settings
      }).catch(() => {});
    });
  });
}

// Initialize on startup
init();

// Handle extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[PhishNet] Installed/updated:', details.reason);
  if (details.reason === 'install') {
    // Set default settings
    await saveSettings(settings);
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[PhishNet] Browser startup');
  init();
});