/**
 * PhishNet Background Service Worker
 * Handles model loading, message routing, and inference coordination
 */

import logger from './utils/logger.js';

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

const pendingInferenceCallbacks = new Map();

/**
 * Initialize background service worker
 */
async function init() {
  logger.debug('Background service worker starting');

  // Load settings from storage
  await loadSettings();

  // Create offscreen document for model inference
  await createOffscreenDocument();

  // Notify tabs of model status
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
        autoScan: result?.autoScan ?? true,
        sensitivityThreshold: result?.sensitivityThreshold ?? 0.7,
        highlightLinks: result?.highlightLinks ?? true,
        showTooltip: result?.showTooltip ?? true
      };
      resolve(settings);
    });
  });
}

/**
 * Save settings to chrome.storage.sync
 */
async function saveSettings(newSettings) {
  settings = { ...settings, ...newSettings };
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => {
      resolve(settings);
    });
  });
}

/**
 * Create offscreen document for model inference
 */
async function createOffscreenDocument() {
  try {
    // Check if offscreen document already exists
    if (chrome.offscreen && typeof chrome.offscreen.hasDocument === 'function') {
      const hasDoc = await chrome.offscreen.hasDocument();
      if (hasDoc) {
        offscreenDocumentCreated = true;
        logger.debug('Offscreen document already exists (hasDocument)');
        return;
      }
    } else if (self.clients && typeof self.clients.matchAll === 'function') {
      const clients = await self.clients.matchAll();
      const existing = clients.find(c => c.url.includes('offscreen.html'));
      if (existing) {
        offscreenDocumentCreated = true;
        logger.debug('Offscreen document already exists (clients.matchAll)');
        return;
      }
    }

    if (offscreenDocumentCreated) return;

    // Create new offscreen document
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('public/offscreen.html'),
      reasons: ['LOCAL_STORAGE', 'WORKERS'],
      justification: 'Run Transformers.js model inference in isolated context'
    });

    offscreenDocumentCreated = true;
    logger.debug('Offscreen document created');

  } catch (error) {
    if (error.message && error.message.includes('Only a single offscreen document may be created')) {
      offscreenDocumentCreated = true;
      return;
    }
    logger.error('Failed to create offscreen document:', error);
    modelStatus = 'error';
    broadcastModelStatus({ error: error.message });
  }
}

/**
 * Single unified message dispatcher
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  handleIncomingMessage(message, sender)
    .then((result) => {
      sendResponse(result);
    })
    .catch((err) => {
      sendResponse({ success: false, error: err.message });
    });

  return true; // Keep channel open for async response
});

/**
 * Route incoming message to appropriate handler
 */
async function handleIncomingMessage(message, sender) {
  switch (message.type) {
    // Content script / tab messages
    case 'CONTENT_READY':
      return { modelStatus, settings };

    case 'SCAN_EMAIL':
      if (modelStatus !== 'ready') {
        logger.debug('Model not ready, returning useHeuristic signal');
        return { success: false, error: 'Model not ready', useHeuristic: true };
      }

      try {
        const result = await runInference(message.payload);
        return { success: true, result };
      } catch (error) {
        logger.error('Inference error:', error);
        return { success: false, error: error.message, useHeuristic: true };
      }

    case 'GET_SETTINGS':
      return settings;

    case 'GET_MODEL_STATUS':
      return { status: modelStatus, progress: modelLoadProgress };

    // Popup messages
    case 'GET_STATUS':
      return { modelStatus, progress: modelLoadProgress, settings };

    case 'UPDATE_SETTINGS':
      await saveSettings(message.settings);
      broadcastSettingsUpdate();
      return { success: true, settings };

    case 'SCAN_CURRENT_TAB': {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].id) {
        return new Promise((resolve) => {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'SCAN_CURRENT_EMAIL' }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: 'Cannot connect to email tab. Refresh the page.' });
            } else {
              resolve(response || { success: false, error: 'No response from page' });
            }
          });
        });
      }
      return { success: false, error: 'No active tab found' };
    }

    case 'RELOAD_MODEL':
      modelStatus = 'loading';
      modelLoadProgress = 0;
      broadcastModelStatus();
      await createOffscreenDocument();
      return { success: true, status: modelStatus };

    // Offscreen document lifecycle messages
    case 'OFFSCREEN_READY':
      modelStatus = 'ready';
      modelLoadProgress = 100;
      broadcastModelStatus();
      return { success: true };

    case 'OFFSCREEN_ERROR':
      modelStatus = 'error';
      broadcastModelStatus({ error: message.error });
      return { success: true };

    case 'MODEL_LOAD_PROGRESS':
      modelLoadProgress = message.progress || 0;
      broadcastModelStatus({ progress: modelLoadProgress, message: message.message });
      return { success: true };

    case 'INFERENCE_RESULT':
      if (pendingInferenceCallbacks.has(message.requestId)) {
        const { resolve } = pendingInferenceCallbacks.get(message.requestId);
        pendingInferenceCallbacks.delete(message.requestId);
        resolve(message.result);
      }
      return { success: true };

    case 'INFERENCE_ERROR':
      if (pendingInferenceCallbacks.has(message.requestId)) {
        const { reject } = pendingInferenceCallbacks.get(message.requestId);
        pendingInferenceCallbacks.delete(message.requestId);
        reject(new Error(message.error));
      }
      return { success: true };

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

/**
 * Run inference via offscreen document with timeout handling
 */
function runInference(emailData) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();

    const timer = setTimeout(() => {
      if (pendingInferenceCallbacks.has(requestId)) {
        pendingInferenceCallbacks.delete(requestId);
        reject(new Error('Inference timeout (15s limit exceeded)'));
      }
    }, 15000);

    pendingInferenceCallbacks.set(requestId, {
      resolve: (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      }
    });

    // Send payload to offscreen document
    chrome.runtime.sendMessage({
      type: 'RUN_INFERENCE',
      requestId,
      payload: emailData,
      settings
    }).catch((err) => {
      clearTimeout(timer);
      pendingInferenceCallbacks.delete(requestId);
      reject(err);
    });
  });
}

/**
 * Broadcast settings update to all tabs
 */
function broadcastSettingsUpdate() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATE',
          payload: settings
        }).catch(() => {});
      }
    });
  });
}

/**
 * Broadcast model status to all tabs
 */
function broadcastModelStatus(extra = {}) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'MODEL_STATUS',
          payload: { status: modelStatus, progress: modelLoadProgress, ...extra }
        }).catch(() => {});
      }
    });
  });
}

// Lifecycle events
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.debug('Extension installed/updated:', details.reason);
  if (details.reason === 'install') {
    await saveSettings(settings);
  }
  init();
});

chrome.runtime.onStartup.addListener(() => {
  logger.debug('Browser startup');
  init();
});

// Initialize on background start
init();