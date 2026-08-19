/**
 * PhishNet Popup Script
 * Handles UI interactions and communicates with background worker
 */

import logger from './utils/logger.js';

// DOM Elements
const statusIndicator = document.getElementById('statusIndicator');
const statusLabel = document.getElementById('statusLabel');
const statusDetail = document.getElementById('statusDetail');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const scanButton = document.getElementById('scanButton');
const scanButtonText = document.getElementById('scanButtonText');
const result = document.getElementById('result');
const resultIcon = document.getElementById('resultIcon');
const resultLabel = document.getElementById('resultLabel');
const resultConfidence = document.getElementById('resultConfidence');
const resultReasons = document.getElementById('resultReasons');
const errorMessage = document.getElementById('errorMessage');

// Settings elements
const settingAutoScan = document.getElementById('settingAutoScan');
const settingHighlightLinks = document.getElementById('settingHighlightLinks');
const settingShowTooltip = document.getElementById('settingShowTooltip');
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdValue = document.getElementById('thresholdValue');

// State
let currentSettings = {
  autoScan: true,
  highlightLinks: true,
  showTooltip: true,
  sensitivityThreshold: 0.7
};

let lastScanResult = null;

/**
 * Initialize popup
 */
async function init() {
  await refreshStatus();
  await loadSettings();

  setupEventListeners();

  // Periodic status refresh
  setInterval(refreshStatus, 4000);
}

/**
 * Refresh model status from background
 */
async function refreshStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

    if (response) {
      updateStatusUI(response.modelStatus, response.progress);
      updateScanButton(response.modelStatus);
    }
  } catch (error) {
    logger.error('Status refresh failed:', error);
  }
}

/**
 * Update status UI
 */
function updateStatusUI(status, progress = 0) {
  statusIndicator.className = 'status-indicator ' + (status || 'loading');

  switch (status) {
    case 'loading':
      statusLabel.textContent = 'Loading model...';
      statusDetail.textContent = progress > 0 ? `${progress}%` : 'Downloading ~50MB model on first use (runs offline once cached)';
      progressBar.classList.add('visible');
      progressFill.style.width = `${progress}%`;
      break;
    case 'ready':
      statusLabel.textContent = 'Protection Active';
      statusDetail.textContent = 'On-device AI ready (100% private)';
      progressBar.classList.remove('visible');
      break;
    case 'error':
      statusLabel.textContent = 'Model Offline';
      statusDetail.textContent = 'Using heuristic rule fallback';
      progressBar.classList.remove('visible');
      break;
  }
}

/**
 * Update scan button state
 */
function updateScanButton(status) {
  // Allow scan even if offline (will use heuristics)
  scanButton.disabled = false;
}

/**
 * Load settings from background
 */
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    if (response) {
      currentSettings = response;
      applySettingsToUI();
    }
  } catch (error) {
    logger.error('Settings load failed:', error);
  }
}

/**
 * Apply settings to UI controls
 */
function applySettingsToUI() {
  if (settingAutoScan) settingAutoScan.checked = !!currentSettings.autoScan;
  if (settingHighlightLinks) settingHighlightLinks.checked = !!currentSettings.highlightLinks;
  if (settingShowTooltip) settingShowTooltip.checked = !!currentSettings.showTooltip;
  if (thresholdSlider && thresholdValue) {
    const val = Math.round((currentSettings.sensitivityThreshold ?? 0.7) * 100);
    thresholdSlider.value = val;
    thresholdValue.textContent = `${val}%`;
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  scanButton.addEventListener('click', handleScanClick);

  settingAutoScan?.addEventListener('change', () => updateSetting('autoScan', settingAutoScan.checked));
  settingHighlightLinks?.addEventListener('change', () => updateSetting('highlightLinks', settingHighlightLinks.checked));
  settingShowTooltip?.addEventListener('change', () => updateSetting('showTooltip', settingShowTooltip.checked));

  thresholdSlider?.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    thresholdValue.textContent = `${value}%`;
  });

  thresholdSlider?.addEventListener('change', (e) => {
    const value = parseInt(e.target.value) / 100;
    updateSetting('sensitivityThreshold', value);
  });
}

/**
 * Handle scan button click
 */
async function handleScanClick() {
  if (scanButton.disabled) return;

  scanButton.disabled = true;
  scanButton.classList.add('scanning');
  scanButtonText.textContent = 'Scanning...';
  hideResult();
  hideError();

  try {
    const response = await chrome.runtime.sendMessage({ type: 'SCAN_CURRENT_TAB' });

    if (response && response.success && response.result) {
      lastScanResult = response.result;
      showResult(response.result);
    } else {
      showError(response?.error || 'No active email found. Open an email in Gmail or Outlook and try again.');
    }
  } catch (error) {
    showError('Scan failed: ' + error.message);
  } finally {
    scanButton.disabled = false;
    scanButton.classList.remove('scanning');
    scanButtonText.textContent = 'Scan Current Email';
  }
}

/**
 * Show scan result safely using DOM methods
 */
function showResult(scanResult) {
  if (!scanResult) return;
  lastScanResult = scanResult;

  result.className = 'result visible ' + getResultClass(scanResult.label);

  const icons = {
    'phishing_email': '⚠️',
    'phishing_url': '🔗',
    'legitimate_email': '🛡️',
    'legitimate_url': '🔗',
    'uncertain': '❓'
  };

  const labels = {
    'phishing_email': 'Phishing Email',
    'phishing_url': 'Phishing Link',
    'legitimate_email': 'Safe Email',
    'legitimate_url': 'Safe Link',
    'uncertain': 'Uncertain / Suspicious'
  };

  resultIcon.textContent = icons[scanResult.label] || '❓';
  resultLabel.textContent = labels[scanResult.label] || 'Analyzed';
  resultConfidence.textContent = `${Math.round((scanResult.confidence || 0) * 100)}%`;

  // Safely populate reasons
  resultReasons.textContent = '';
  if (scanResult.reasons && scanResult.reasons.length > 0) {
    scanResult.reasons.forEach(r => {
      const reasonDiv = document.createElement('div');
      reasonDiv.className = 'result-reason';
      reasonDiv.textContent = r;
      resultReasons.appendChild(reasonDiv);
    });
  } else {
    const reasonDiv = document.createElement('div');
    reasonDiv.className = 'result-reason';
    reasonDiv.textContent = 'Standard email patterns observed';
    resultReasons.appendChild(reasonDiv);
  }

  result.style.display = 'block';
}

/**
 * Get CSS class for result
 */
function getResultClass(label = '') {
  if (label.includes('phishing')) return 'phishing';
  if (label.includes('legitimate')) return 'safe';
  return 'uncertain';
}

/**
 * Hide result
 */
function hideResult() {
  result.className = 'result';
  result.style.display = 'none';
}

/**
 * Show error message
 */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('visible');
  errorMessage.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError() {
  errorMessage.textContent = '';
  errorMessage.classList.remove('visible');
  errorMessage.style.display = 'none';
}

/**
 * Update setting in background
 */
async function updateSetting(key, value) {
  currentSettings[key] = value;

  try {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: currentSettings
    });
  } catch (error) {
    logger.error('Settings update failed:', error);
    loadSettings();
  }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', init);