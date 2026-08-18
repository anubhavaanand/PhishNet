/**
 * PhishNet Popup Script
 * Handles UI interactions and communicates with background
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
const resultLabel = document.getElementById('ResultLabel');
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
  // Load current status and settings
  await refreshStatus();
  await loadSettings();

  // Set up event listeners
  setupEventListeners();

  // Periodic status refresh
  setInterval(refreshStatus, 5000);
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
  // Update indicator
  statusIndicator.className = 'status-indicator ' + status;

  // Update labels
  switch (status) {
    case 'loading':
      statusLabel.textContent = 'Loading model...';
      statusDetail.textContent = progress > 0 ? `${progress}%` : 'Downloading ~50MB model on first use';
      progressBar.classList.add('visible');
      progressFill.style.width = `${progress}%`;
      break;
    case 'ready':
      statusLabel.textContent = 'Ready';
      statusDetail.textContent = 'Model loaded - protection active';
      progressBar.classList.remove('visible');
      break;
    case 'error':
      statusLabel.textContent = 'Error';
      statusDetail.textContent = 'Failed to load model';
      progressBar.classList.remove('visible');
      break;
  }
}

/**
 * Update scan button state
 */
function updateScanButton(status) {
  const isReady = status === 'ready';
  scanButton.disabled = !isReady;

  if (isReady) {
    scanButtonText.textContent = 'Scan Current Email';
    scanButton.classList.remove('scanning');
  }
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
  settingAutoScan.checked = currentSettings.autoScan;
  settingHighlightLinks.checked = currentSettings.highlightLinks;
  settingShowTooltip.checked = currentSettings.showTooltip;
  thresholdSlider.value = Math.round(currentSettings.sensitivityThreshold * 100);
  thresholdValue.textContent = `${thresholdSlider.value}%`;
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Scan button
  scanButton.addEventListener('click', handleScanClick);

  // Settings toggles
  settingAutoScan.addEventListener('change', () => updateSetting('autoScan', settingAutoScan.checked));
  settingHighlightLinks.addEventListener('change', () => updateSetting('highlightLinks', settingHighlightLinks.checked));
  settingShowTooltip.addEventListener('change', () => updateSetting('showTooltip', settingShowTooltip.checked));

  // Threshold slider
  thresholdSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    thresholdValue.textContent = `${value}%`;
  });
  thresholdSlider.addEventListener('change', (e) => {
    const value = parseInt(e.target.value) / 100;
    updateSetting('sensitivityThreshold', value);
  });
}

/**
 * Handle scan button click
 */
async function handleScanClick() {
  if (scanButton.disabled) return;

  // Show loading state
  scanButton.disabled = true;
  scanButton.classList.add('scanning');
  scanButton.innerHTML = '<span class="spinner"></span> Scanning...';
  hideResult();
  hideError();

  try {
    const response = await chrome.runtime.sendMessage({ type: 'SCAN_CURRENT_TAB' });

    if (response.success) {
      lastScanResult = response.result;
      showResult(response.result);
    } else {
      showError(response.error || 'Scan failed. Make sure you\'re on Gmail or Outlook.');
    }
  } catch (error) {
    showError('Scan failed: ' + error.message);
  } finally {
    scanButton.disabled = false;
    scanButton.classList.remove('scanning');
    scanButton.innerHTML = '<span id="scanButtonText">Scan Current Email</span>';
  }
}

/**
 * Show scan result
 */
function showResult(scanResult) {
  lastScanResult = scanResult;

  // Set result styling
  result.className = 'result visible ' + getResultClass(scanResult.label);

  // Update icon and label
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
    'uncertain': 'Uncertain'
  };

  resultIcon.textContent = icons[scanResult.label] || '❓';
  resultLabel.textContent = labels[scanResult.label] || 'Unknown';
  resultConfidence.textContent = `${Math.round(scanResult.confidence * 100)}%`;

  // Show reasons
  if (scanResult.reasons && scanResult.reasons.length > 0) {
    resultReasons.innerHTML = scanResult.reasons
      .map(r => `<div class="result-reason">${escapeHtml(r)}</div>`)
      .join('');
  } else {
    resultReasons.innerHTML = '<div class="result-reason">No specific reasons available</div>';
  }

  result.style.display = 'block';
}

/**
 * Get CSS class for result
 */
function getResultClass(label) {
  if (label.includes('phishing')) return 'phishing';
  if (label.includes('legitimate')) return 'safe';
  return 'uncertain';
}

/**
 * Hide result
 */
function hideResult() {
  result.classList.remove('visible', 'safe', 'phishing', 'uncertain');
  result.style.display = 'none';
}

/**
 * Show error message
 */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('visible');
}

/**
 * Hide error message
 */
function hideError() {
  errorMessage.classList.remove('visible');
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
    // Revert UI on failure
    loadSettings();
  }
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', init);