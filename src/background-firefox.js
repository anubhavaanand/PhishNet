/**
 * PhishNet Background — FIREFOX variant (event page, classic script)
 *
 * Firefox MV3 uses event pages with DOM access instead of service workers,
 * and has no chrome.offscreen API. So the DistilBERT pipeline runs directly
 * in this context via dynamic import() of the vendored ESM bundle.
 *
 * Mirrors src/background.js behavior: same message types, same response
 * shapes, same heuristic-fallback signal ({ success:false, useHeuristic }).
 */

// ---- tiny logger (classic script: no ESM imports allowed) ----
const log = {
  debug: () => {},
  info: () => {},
  warn: (...a) => console.warn('[PhishNet]', ...a),
  error: (...a) => console.error('[PhishNet]', ...a)
};

// ---- state ----
let modelStatus = 'loading'; // 'loading' | 'ready' | 'error'
let modelLoadProgress = 0;
let classifierPromise = null;
let classifier = null;

const DEFAULT_SETTINGS = {
  autoScan: true,
  sensitivityThreshold: 0.7,
  highlightLinks: true,
  showTooltip: true,
  theme: 'aloe',
  whitelist: ['github.com', 'google.com', 'microsoft.com', 'amazon.com', 'apple.com']
};

let settings = { ...DEFAULT_SETTINGS };

// ---- model wiring (Transformers.js v3, local vendor bundle) ----
const MODEL_ID = 'onnx-community/phishing-email-detection-distilbert_v2.4.1-ONNX';
const LABEL_MAP = {
  LABEL_0: 'legitimate_email',
  LABEL_1: 'phishing_email',
  LABEL_2: 'legitimate_url',
  LABEL_3: 'phishing_url'
};
const LABEL_REASONS = {
  legitimate_email: 'Content appears legitimate',
  phishing_email: 'Content matches phishing patterns',
  legitimate_url: 'Links appear safe',
  phishing_url: 'Suspicious links detected'
};

function reportProgress(progress, message) {
  modelLoadProgress = progress;
  broadcastModelStatus({ progress, message });
}

async function ensureClassifier() {
  if (classifier) return classifier;
  if (classifierPromise) return classifierPromise;
  if (typeof browser === 'undefined' || !browser.runtime?.getURL) {
    throw new Error('Extension runtime unavailable');
  }

  reportProgress(8, 'Loading AI runtime…');

  classifierPromise = (async () => {
    // Dynamic import works in classic event-page scripts.
    const tf = await import(browser.runtime.getURL('vendor/transformers.min.js'));
    const { pipeline, env } = tf;

    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = true;
    // ORT assets live next to the bundle inside the extension.
    env.backends.onnx.wasm.wasmPaths = browser.runtime.getURL('vendor/ort-wasm/');
    // Firefox cannot set cross-origin isolation headers for COOP/COEP,
    // so multi-threaded WASM is unavailable — stay single-threaded.
    env.backends.onnx.wasm.numThreads = 1;

    reportProgress(20, 'Downloading model (~50MB, cached after first run)…');

    let lastProgressAt = 0;
    const pipe = await pipeline('text-classification', MODEL_ID, {
      dtype: 'q8',
      device: 'wasm', // WebGPU in FF background pages is unreliable; force stable path
      progress_callback: (p) => {
        if (p && p.status === 'progress' && typeof p.progress === 'number') {
          const now = Date.now();
          if (now - lastProgressAt > 400) {
            lastProgressAt = now;
            reportProgress(20 + Math.round(p.progress * 0.7), 'Downloading model…');
          }
        }
      }
    });

    reportProgress(92, 'Warming up…');
    await pipe('warmup test email');

    classifier = pipe;
    modelStatus = 'ready';
    reportProgress(100, 'Protected');
    broadcastModelStatus();
    log.debug('Model ready');
    return pipe;
  })();

  try {
    return await classifierPromise;
  } catch (err) {
    log.error('Model load failed:', err);
    modelStatus = 'error';
    classifierPromise = null;
    broadcastModelStatus({ error: err.message });
    throw err;
  }
}

function truncateText(text, maxTokens) {
  if (!text) return '';
  const maxChars = maxTokens * 4;
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}

function isUrlSuspicious(url) {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.toLowerCase();
    const tlds = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club', '.work', '.date', '.loan', '.win'];
    for (const t of tlds) if (domain.endsWith(t)) return true;
    const shorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly'];
    for (const s of shorteners) if (domain === s || domain.endsWith('.' + s)) return true;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return true;
    if (domain.split('.').length > 4) return true;
    const kws = ['secure', 'verify', 'account', 'login', 'signin', 'update', 'confirm'];
    for (const kw of kws) {
      if (domain.includes(kw) && !domain.startsWith(kw + '.') && !domain.endsWith('.' + kw + '.com')) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function generateReasons(predictions, text, threshold) {
  const reasons = [];
  const topLabel = LABEL_MAP[predictions[0]?.label] || 'uncertain';
  if (LABEL_REASONS[topLabel]) reasons.push(LABEL_REASONS[topLabel]);
  if (predictions[0]?.score < threshold) reasons.push('Low confidence - manual review recommended');

  const lower = (text || '').toLowerCase();
  const kws = ['urgent', 'immediate', 'verify', 'account', 'suspend', 'locked', 'click here', 'confirm', 'password'];
  const found = kws.filter((k) => lower.includes(k));
  if (found.length) reasons.push(`Contains urgency keywords: ${found.slice(0, 3).join(', ')}`);

  const urls = (text || '').match(/https?:\/\/[^\s"'<>]+/g) || [];
  const bad = urls.filter(isUrlSuspicious).length;
  if (bad) reasons.push(`${bad} suspicious link(s) detected`);

  return reasons.slice(0, 5);
}

async function runInference(emailData) {
  const pipe = await ensureClassifier();
  const started = performance.now();
  const text = truncateText(String(emailData?.text || ''), 512);

  const results = await pipe(text, { topk: 4 });
  const predictions = Array.isArray(results) ? results : [results];
  predictions.sort((a, b) => b.score - a.score);
  const top = predictions[0];

  return {
    label: LABEL_MAP[top.label] || 'uncertain',
    confidence: top.score,
    reasons: generateReasons(predictions, emailData?.text, settings.sensitivityThreshold),
    processingTime: Math.round(performance.now() - started),
    allScores: predictions.reduce((acc, p) => {
      acc[LABEL_MAP[p.label] || p.label] = p.score;
      return acc;
    }, {})
  };
}

// ---- settings ----
async function loadSettings() {
  const got = await browser.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  settings = {
    autoScan: got.autoScan ?? true,
    sensitivityThreshold: got.sensitivityThreshold ?? 0.7,
    highlightLinks: got.highlightLinks ?? true,
    showTooltip: got.showTooltip ?? true,
    theme: got.theme ?? 'aloe',
    whitelist: Array.isArray(got.whitelist) ? got.whitelist : [...DEFAULT_SETTINGS.whitelist]
  };
  return settings;
}

async function saveSettings(newSettings) {
  settings = { ...settings, ...newSettings };
  await browser.storage.sync.set(settings);
  return settings;
}

// ---- broadcasts ----
function broadcastToTabs(payload) {
  browser.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id != null) {
        browser.tabs.sendMessage(tab.id, payload).catch(() => {});
      }
    }
  }).catch(() => {});
}

function broadcastModelStatus(extra = {}) {
  broadcastToTabs({ type: 'MODEL_STATUS', payload: { status: modelStatus, progress: modelLoadProgress, ...extra } });
}

function broadcastSettingsUpdate() {
  broadcastToTabs({ type: 'SETTINGS_UPDATE', payload: settings });
}

// ---- message router (same contract as Chrome background) ----
browser.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) return undefined;
  return handleMessage(message); // returning a Promise = async sendResponse in FF
});

async function handleMessage(message) {
  switch (message.type) {
    case 'CONTENT_READY':
      return { modelStatus, settings };

    case 'SCAN_EMAIL': {
      if (modelStatus !== 'ready') {
        return { success: false, error: 'Model not ready', useHeuristic: true };
      }
      try {
        const result = await runInference(message.payload);
        return { success: true, result };
      } catch (error) {
        log.error('Inference error:', error);
        return { success: false, error: error.message, useHeuristic: true };
      }
    }

    case 'GET_SETTINGS':
      return settings;

    case 'GET_MODEL_STATUS':
      return { status: modelStatus, progress: modelLoadProgress };

    case 'GET_STATUS':
      return { modelStatus, progress: modelLoadProgress, settings };

    case 'UPDATE_SETTINGS': {
      settings = await saveSettings(message.settings || {});
      broadcastSettingsUpdate();
      return { success: true, settings };
    }

    case 'ADD_WHITELIST': {
      const entry = String(message.entry || '').trim().toLowerCase();
      if (entry && !settings.whitelist.includes(entry)) {
        settings.whitelist.push(entry);
        await saveSettings({ whitelist: settings.whitelist });
        broadcastSettingsUpdate();
      }
      return { success: true, whitelist: settings.whitelist };
    }

    case 'REMOVE_WHITELIST': {
      const entry = String(message.entry || '').trim().toLowerCase();
      settings.whitelist = settings.whitelist.filter((w) => w !== entry);
      await saveSettings({ whitelist: settings.whitelist });
      broadcastSettingsUpdate();
      return { success: true, whitelist: settings.whitelist };
    }

    case 'CLEAR_HISTORY':
      await browser.storage.local.set({
        scanHistory: [],
        scanStats: { total: 0, phishing: 0, safe: 0, uncertain: 0, trusted: 0 }
      });
      return { success: true };

    case 'SCAN_CURRENT_TAB': {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs.length || tabs[0].id == null) return { success: false, error: 'No active tab found' };
      try {
        const response = await browser.tabs.sendMessage(tabs[0].id, { type: 'SCAN_CURRENT_EMAIL' });
        return response || { success: false, error: 'No response from page' };
      } catch {
        return { success: false, error: 'Cannot connect to email tab. Refresh the page.' };
      }
    }

    case 'RELOAD_MODEL':
      modelStatus = 'loading';
      modelLoadProgress = 0;
      classifier = null;
      classifierPromise = null;
      broadcastModelStatus();
      ensureClassifier().catch(() => {});
      return { success: true, status: modelStatus };

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

// ---- boot ----
(async () => {
  await loadSettings();
  // Kick off model load eagerly; failures degrade to heuristics.
  ensureClassifier().catch(() => {});
})();
