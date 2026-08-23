/**
 * PhishNet Offscreen Document
 * Loads and runs the Transformers.js model for phishing detection
 */

import { pipeline, env } from '../vendor/transformers.min.js';
import logger from './utils/logger.js';
// Side-effect import: installs globalThis.PhishNet (shared v1.1 detection
// engine — skeletoning, Damerau typosquats, hardened URL checks)
import './utils/heuristic-detector.js';

const {
  isUrlSuspicious,
  isDomainSuspicious,
  checkLookalikeBrand
} = globalThis.PhishNet;

// Configure Transformers.js environment
env.allowLocalModels = false; // Download from Hugging Face Hub, then cache in IndexedDB
env.allowRemoteModels = true;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('vendor/ort-wasm/');
env.backends.onnx.wasm.numThreads = 1; // Single thread for browser compatibility

// Model configuration
const MODEL_ID = 'onnx-community/phishing-email-detection-distilbert_v2.4.1-ONNX';
const MODEL_OPTIONS = {
  dtype: 'q8',  // Quantized for smaller size (~50MB)
  device: 'auto' // Use WebGPU if available, fallback to WASM
};

// Label mapping from model output (based on cybersectony/phishing-email-detection-distilbert_v2.4.1)
const LABEL_MAP = {
  'LABEL_0': 'legitimate_email',
  'LABEL_1': 'phishing_email',
  'LABEL_2': 'legitimate_url',
  'LABEL_3': 'phishing_url'
};

// Reverse mapping for reasons
const LABEL_REASONS = {
  'legitimate_email': 'Content appears legitimate',
  'phishing_email': 'Content matches phishing patterns',
  'legitimate_url': 'Links appear safe',
  'phishing_url': 'Suspicious links detected'
};

// State
let classifier = null;
let modelLoaded = false;
let loadAttempts = 0;
const MAX_LOAD_ATTEMPTS = 3;

/**
 * Initialize and load model with retry logic
 */
async function init() {
  logger.debug('Initializing offscreen document...');

  while (loadAttempts < MAX_LOAD_ATTEMPTS && !modelLoaded) {
    loadAttempts++;
    logger.debug(`Model load attempt ${loadAttempts}/${MAX_LOAD_ATTEMPTS}`);

    try {
      // Report progress
      reportProgress(Math.min(15 * loadAttempts, 35), `Loading model (attempt ${loadAttempts})...`);

      // Load classification pipeline (handles tokenizer internally)
      classifier = await pipeline('text-classification', MODEL_ID, MODEL_OPTIONS);

      reportProgress(80, 'Warming up model...');

      // Warm up with dummy inference
      await classifier('Test email for warmup');

      reportProgress(100, 'Model ready');
      modelLoaded = true;

      // Notify background
      chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' });
      logger.debug('Model loaded successfully');
      return;

    } catch (error) {
      logger.error(`Model load attempt ${loadAttempts} failed:`, error);
      
      if (loadAttempts >= MAX_LOAD_ATTEMPTS) {
        logger.error('All model load attempts failed');
        chrome.runtime.sendMessage({
          type: 'OFFSCREEN_ERROR',
          error: `Failed to load model after ${MAX_LOAD_ATTEMPTS} attempts: ${error.message}`
        });
        return;
      }
      
      // Wait before retry
      await new Promise(r => setTimeout(r, 2000 * loadAttempts));
    }
  }
}

/**
 * Report loading progress to background
 */
function reportProgress(progress, message) {
  chrome.runtime.sendMessage({
    type: 'MODEL_LOAD_PROGRESS',
    progress,
    message
  }).catch(() => {});
}

/**
 * Run inference on email text with timeout protection
 */
async function runInference(text, settings = {}) {
  if (!classifier || !modelLoaded) {
    throw new Error('Model not loaded');
  }

  const inferencePromise = (async () => {
    const startTime = performance.now();

    // Truncate text to 512 tokens (approximate: 1 token ≈ 4 chars)
    const truncatedText = truncateText(text, 512);

    // Run classification
    const results = await classifier(truncatedText, {
      topk: 4 // Get all class probabilities
    });

    const processingTime = Math.round(performance.now() - startTime);

    // Process results
    const predictions = Array.isArray(results) ? results : [results];

    // Sort by score descending
    predictions.sort((a, b) => b.score - a.score);

    const topPrediction = predictions[0];
    const label = LABEL_MAP[topPrediction.label] || 'uncertain';
    const confidence = topPrediction.score;

    // Generate reasons based on predictions
    const reasons = generateReasons(predictions, text, settings);

    return {
      label,
      confidence,
      reasons,
      processingTime,
      allScores: predictions.reduce((acc, p) => {
        acc[LABEL_MAP[p.label] || p.label] = p.score;
        return acc;
      }, {})
    };
  })();

  // Race against timeout (15 seconds); always clear the timer to avoid
  // unhandled rejections when inference completes first
  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error('Inference timeout')), 15000);
  });

  try {
    return await Promise.race([inferencePromise, timeoutPromise]);
  } finally {
    clearTimeout(timerId);
  }
}

/**
 * Truncate text to approximate token limit
 */
function truncateText(text, maxTokens) {
  if (!text) return '';
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

/**
 * Generate human-readable reasons
 */
function generateReasons(predictions, text = '', settings = {}) {
  const reasons = [];

  // Top prediction reason
  const topLabel = LABEL_MAP[predictions[0]?.label] || 'uncertain';
  if (LABEL_REASONS[topLabel]) {
    reasons.push(LABEL_REASONS[topLabel]);
  }

  // Sensitivity threshold check
  const threshold = settings.sensitivityThreshold ?? 0.7;
  if (predictions[0]?.score < threshold) {
    reasons.push('Low confidence - manual review recommended');
  }

  // Check for phishing keywords
  const phishingKeywords = [
    'urgent', 'immediate', 'verify', 'account', 'suspend', 'locked',
    'click here', 'confirm', 'update', 'security', 'unauthorized',
    'limited time', 'act now', 'expire', 'password', 'credential'
  ];

  const lowerText = text.toLowerCase();
  const foundKeywords = phishingKeywords.filter(kw => lowerText.includes(kw));

  if (foundKeywords.length > 0) {
    reasons.push(`Contains urgency keywords: ${foundKeywords.slice(0, 3).join(', ')}`);
  }

  // Check for suspicious links
  const urlRegex = /https?:\/\/[^\s"'<>]+/g;
  const urls = text.match(urlRegex) || [];

  let suspiciousLinks = 0;
  for (const url of urls) {
    if (isUrlSuspicious(url)) suspiciousLinks++;
  }

  if (suspiciousLinks > 0) {
    reasons.push(`${suspiciousLinks} suspicious link(s) detected`);
  }

  // Sender domain analysis + v1.1 brand-lookalike detection
  const emailRegex = /[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    const domain = match[1]?.toLowerCase();
    if (!domain) continue;
    if (isDomainSuspicious(domain)) {
      reasons.push(`Suspicious sender domain: ${domain}`);
      break;
    }
    const lookalike = checkLookalikeBrand(domain);
    if (lookalike && lookalike.brand && lookalike.brand !== 'unknown') {
      reasons.push(`Domain mimics "${lookalike.brand}" (${domain})`);
      break;
    }
  }

  return reasons.slice(0, 5);
}

/**
 * Handle messages from background
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  switch (message.type) {
    case 'RUN_INFERENCE':
      runInference(message.payload?.text || '', message.settings || {})
        .then(result => {
          chrome.runtime.sendMessage({
            type: 'INFERENCE_RESULT',
            requestId: message.requestId,
            result
          }).catch(() => {});
        })
        .catch(error => {
          chrome.runtime.sendMessage({
            type: 'INFERENCE_ERROR',
            requestId: message.requestId,
            error: error.message
          }).catch(() => {});
        });
      sendResponse({ success: true });
      break;
  }
  return true;
});

// Initialize on load
init();