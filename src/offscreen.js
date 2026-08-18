/**
 * PhishNet Offscreen Document
 * Loads and runs the Transformers.js model for phishing detection
 */

import { pipeline, env, AutoTokenizer } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0';
import logger from './utils/logger.js';

// Configure Transformers.js environment
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.useBrowserCache = true;
env.localModelPath = chrome.runtime.getURL('models/');
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/ort-wasm/';

// Model configuration
const MODEL_ID = 'onnx-community/phishing-email-detection-distilbert_v2.4.1-ONNX';
const MODEL_OPTIONS = {
  dtype: 'q8',  // Quantized for smaller size
  device: 'auto' // Use WebGPU if available, fallback to WASM
};

// Label mapping from model output
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
let tokenizer = null;
let modelLoaded = false;

/**
 * Initialize and load model
 */
async function init() {
  logger.debug('Initializing...');

  try {
    // Report progress
    reportProgress(10, 'Loading tokenizer...');

    // Load tokenizer first
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);

    reportProgress(30, 'Loading model...');

    // Load classification pipeline
    classifier = await pipeline('text-classification', MODEL_ID, MODEL_OPTIONS);

    reportProgress(80, 'Warming up model...');

    // Warm up with a dummy inference
    await classifier('Test email for warmup');

    reportProgress(100, 'Model ready');

    modelLoaded = true;

    // Notify background
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' });

    logger.debug('Model loaded successfully');

  } catch (error) {
    logger.error('Failed to load model:', error);
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_ERROR',
      error: error.message
    });
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
  });
}

/**
 * Run inference on email text
 */
async function runInference(text, settings) {
  if (!classifier || !modelLoaded) {
    throw new Error('Model not loaded');
  }

  const startTime = performance.now();

  try {
    // Truncate text to 512 tokens (approximate)
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

  } catch (error) {
    logger.error('Inference error:', error);
    throw error;
  }
}

/**
 * Truncate text to approximate token limit
 */
function truncateText(text, maxTokens) {
  // Rough approximation: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

/**
 * Generate human-readable reasons
 */
function generateReasons(predictions, text, settings) {
  const reasons = [];

  // Top prediction reason
  const topLabel = LABEL_MAP[predictions[0].label] || 'uncertain';
  if (LABEL_REASONS[topLabel]) {
    reasons.push(LABEL_REASONS[topLabel]);
  }

  // Confidence-based reason
  if (predictions[0].score < settings.sensitivityThreshold) {
    reasons.push('Low confidence - manual review recommended');
  }

  // Check for phishing keywords
  const phishingKeywords = [
    'urgent', 'immediate', 'verify', 'account', 'suspend', 'locked',
    'click here', 'confirm', 'update', 'security', 'unauthorized',
    'limited time', 'act now', 'expire', 'password', 'credential'
  ];

  const foundKeywords = phishingKeywords.filter(kw =>
    text.toLowerCase().includes(kw.toLowerCase())
  );

  if (foundKeywords.length > 0) {
    reasons.push(`Contains urgency keywords: ${foundKeywords.slice(0, 3).join(', ')}`);
  }

  // Check for suspicious links (if present in text)
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex) || [];

  let suspiciousLinks = 0;
  for (const url of urls) {
    if (isUrlSuspicious(url)) suspiciousLinks++;
  }

  if (suspiciousLinks > 0) {
    reasons.push(`${suspiciousLinks} suspicious link(s) detected`);
  }

  // Sender domain mismatch (if detectable)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex) || [];

  for (const email of emails) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && isDomainSuspicious(domain)) {
      reasons.push(`Suspicious sender domain: ${domain}`);
      break;
    }
  }

  return reasons.slice(0, 5); // Limit to 5 reasons
}

/**
 * Check if URL is suspicious
 */
function isUrlSuspicious(url) {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.toLowerCase();

    // Suspicious TLDs
    const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club'];
    for (const tld of suspiciousTlds) {
      if (domain.endsWith(tld)) return true;
    }

    // URL shorteners
    const shorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd'];
    for (const s of shorteners) {
      if (domain.includes(s)) return true;
    }

    // IP address
    if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return true;

    // Excessive subdomains
    if (domain.split('.').length > 4) return true;

    // Suspicious keywords in domain
    const keywords = ['secure', 'verify', 'account', 'login', 'signin', 'update', 'confirm'];
    for (const kw of keywords) {
      if (domain.includes(kw) && !domain.startsWith(kw + '.')) return true;
    }

  } catch (e) {
    return true; // Invalid URL
  }

  return false;
}

/**
 * Check if domain is suspicious
 */
function isDomainSuspicious(domain) {
  const suspiciousPatterns = [
    /^(security|support|admin|noreply|no-reply)@/,
    /[0-9]{5,}/, // Many numbers
    /(paypal|amazon|microsoft|apple|google|bank|chase|wells|fargo|citi)\.[a-z]+$/, // Brand in subdomain
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(domain)) return true;
  }

  return false;
}

/**
 * Handle messages from background
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'RUN_INFERENCE':
      runInference(message.payload.text, message.settings)
        .then(result => {
          chrome.runtime.sendMessage({
            type: 'INFERENCE_RESULT',
            requestId: message.requestId,
            result
          });
        })
        .catch(error => {
          chrome.runtime.sendMessage({
            type: 'INFERENCE_ERROR',
            requestId: message.requestId,
            error: error.message
          });
        });
      sendResponse({ success: true });
      break;
  }
  return true;
});

// Initialize on load
init();