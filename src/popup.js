/**
 * PhishNet Popup Script
 * Coordinates UI tabs, scan requests, local stats, whitelist, and settings
 */

import logger from './utils/logger.js';

// DOM Elements
const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');

const scanButton = document.getElementById('scanButton');
const scanButtonText = document.getElementById('scanButtonText');
const resultCard = document.getElementById('resultCard');
const resultIcon = document.getElementById('resultIcon');
const resultLabel = document.getElementById('resultLabel');
const resultConfidence = document.getElementById('resultConfidence');
const resultReasons = document.getElementById('resultReasons');
const errorBox = document.getElementById('errorBox');

// Stats Elements
const statTotal = document.getElementById('statTotal');
const statBlocked = document.getElementById('statBlocked');
const statSafe = document.getElementById('statSafe');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Whitelist Elements
const whitelistInput = document.getElementById('whitelistInput');
const addWhitelistBtn = document.getElementById('addWhitelistBtn');
const whitelistList = document.getElementById('whitelistList');

// Settings Elements
const settingAutoScan = document.getElementById('settingAutoScan');
const settingHighlightLinks = document.getElementById('settingHighlightLinks');
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdValue = document.getElementById('thresholdValue');

// Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// State
let currentSettings = {
  autoScan: true,
  highlightLinks: true,
  sensitivityThreshold: 0.7,
  whitelist: []
};

/**
 * Initialize popup
 */
async function init() {
  setupTabs();
  setupEventListeners();

  await refreshStatus();
  await loadSettings();
  await loadStatsAndHistory();

  setInterval(refreshStatus, 4000);
}

/**
 * Tab Navigation Setup
 */
function setupTabs() {
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(targetId)?.classList.add('active');

      if (targetId === 'tab-stats') {
        loadStatsAndHistory();
      } else if (targetId === 'tab-whitelist') {
        renderWhitelist();
      }
    });
  });
}

/**
 * Refresh Model & Service Worker Status
 */
async function refreshStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

    if (response) {
      updateStatusUI(response.modelStatus, response.progress);
    }
  } catch (error) {
    logger.error('Status refresh failed:', error);
  }
}

/**
 * Update Status UI
 */
function updateStatusUI(status = 'loading', progress = 0) {
  statusDot.className = 'status-dot ' + status;

  switch (status) {
    case 'loading':
      statusLabel.textContent = progress > 0 ? `Loading ${progress}%` : 'Loading AI...';
      progressBar.classList.add('visible');
      progressFill.style.width = `${progress}%`;
      break;
    case 'ready':
      statusLabel.textContent = 'Protected';
      progressBar.classList.remove('visible');
      break;
    case 'error':
      statusLabel.textContent = 'Rules Active';
      progressBar.classList.remove('visible');
      break;
  }
}

/**
 * Load Settings from Background
 */
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    if (response) {
      currentSettings = Object.assign(currentSettings, response);
      applySettingsToUI();
      renderWhitelist();
    }
  } catch (error) {
    logger.error('Settings load failed:', error);
  }
}

/**
 * Apply Settings to UI
 */
function applySettingsToUI() {
  if (settingAutoScan) settingAutoScan.checked = !!currentSettings.autoScan;
  if (settingHighlightLinks) settingHighlightLinks.checked = !!currentSettings.highlightLinks;
  if (thresholdSlider && thresholdValue) {
    const val = Math.round((currentSettings.sensitivityThreshold ?? 0.7) * 100);
    thresholdSlider.value = val;
    thresholdValue.textContent = `${val}%`;
  }
}

/**
 * Load Local Stats & Scan History
 */
function loadStatsAndHistory() {
  if (!chrome.storage?.local) return;

  chrome.storage.local.get(['scanHistory', 'scanStats'], (data) => {
    const stats = data.scanStats || { total: 0, phishing: 0, safe: 0, uncertain: 0, trusted: 0 };
    const history = data.scanHistory || [];

    if (statTotal) statTotal.textContent = String(stats.total);
    if (statBlocked) statBlocked.textContent = String(stats.phishing);
    if (statSafe) statSafe.textContent = String(stats.safe + stats.trusted);

    if (historyList) {
      historyList.textContent = '';
      if (history.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'font-size: 11px; color: #64748b; text-align: center; padding: 12px 0;';
        emptyDiv.textContent = 'No emails scanned yet';
        historyList.appendChild(emptyDiv);
      } else {
        history.forEach(item => {
          const row = document.createElement('div');
          row.className = 'history-item';

          const sub = document.createElement('span');
          sub.className = 'history-subject';
          sub.title = `${item.subject} (${item.sender})`;
          sub.textContent = item.subject || item.sender;

          const tag = document.createElement('span');
          const isPhish = item.label.includes('phishing');
          const isSafe = item.label.includes('legitimate');
          const isTrusted = item.label === 'trusted';

          tag.className = 'history-tag ' + (isPhish ? 'phishing' : (isTrusted ? 'trusted' : (isSafe ? 'safe' : 'uncertain')));
          tag.textContent = isTrusted ? 'Trusted' : (isPhish ? 'Phish' : (isSafe ? 'Safe' : 'Uncertain'));

          row.appendChild(sub);
          row.appendChild(tag);
          historyList.appendChild(row);
        });
      }
    }
  });
}

/**
 * Render Whitelist Items
 */
function renderWhitelist() {
  if (!whitelistList) return;
  whitelistList.textContent = '';

  const list = currentSettings.whitelist || [];
  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size: 11px; color: #64748b; text-align: center; padding: 12px 0;';
    empty.textContent = 'No trusted senders added yet';
    whitelistList.appendChild(empty);
    return;
  }

  list.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'whitelist-item';

    const text = document.createElement('span');
    text.textContent = entry;

    const delBtn = document.createElement('button');
    delBtn.className = 'remove-btn';
    delBtn.textContent = '✕';
    delBtn.title = 'Remove from trusted';
    delBtn.addEventListener('click', () => removeWhitelistEntry(entry));

    item.appendChild(text);
    item.appendChild(delBtn);
    whitelistList.appendChild(item);
  });
}

/**
 * Add Whitelist Entry
 */
async function addWhitelistEntry() {
  const inputVal = (whitelistInput.value || '').trim().toLowerCase();
  if (!inputVal) return;

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'ADD_WHITELIST',
      entry: inputVal
    });
    if (res?.success) {
      currentSettings.whitelist = res.whitelist;
      whitelistInput.value = '';
      renderWhitelist();
    }
  } catch (e) {
    logger.error('Failed to add whitelist entry:', e);
  }
}

/**
 * Remove Whitelist Entry
 */
async function removeWhitelistEntry(entry) {
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'REMOVE_WHITELIST',
      entry
    });
    if (res?.success) {
      currentSettings.whitelist = res.whitelist;
      renderWhitelist();
    }
  } catch (e) {
    logger.error('Failed to remove whitelist entry:', e);
  }
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  scanButton.addEventListener('click', handleScanClick);

  addWhitelistBtn?.addEventListener('click', addWhitelistEntry);
  whitelistInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addWhitelistEntry();
  });

  clearHistoryBtn?.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
    loadStatsAndHistory();
  });

  settingAutoScan?.addEventListener('change', () => updateSetting('autoScan', settingAutoScan.checked));
  settingHighlightLinks?.addEventListener('change', () => updateSetting('highlightLinks', settingHighlightLinks.checked));

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
 * Handle Manual Scan Click
 */
async function handleScanClick() {
  if (scanButton.disabled) return;

  scanButton.disabled = true;
  scanButtonText.textContent = 'Scanning email...';
  hideResult();
  hideError();

  try {
    const response = await chrome.runtime.sendMessage({ type: 'SCAN_CURRENT_TAB' });

    if (response && response.success && response.result) {
      showResult(response.result);
      loadStatsAndHistory();
    } else {
      showError(response?.error || 'No email open in Gmail/Outlook. Open an email and try again.');
    }
  } catch (error) {
    showError('Scan failed: ' + error.message);
  } finally {
    scanButton.disabled = false;
    scanButtonText.textContent = 'Scan Current Email';
  }
}

/**
 * Show Scan Result
 */
function showResult(scanResult) {
  if (!scanResult) return;

  const isPhish = scanResult.label.includes('phishing');
  const isSafe = scanResult.label.includes('legitimate');
  const isTrusted = scanResult.label === 'trusted';

  resultCard.className = 'result-card visible ' + (isTrusted ? 'trusted' : (isPhish ? 'phishing' : (isSafe ? 'safe' : 'uncertain')));

  const icons = {
    'phishing_email': '⚠️',
    'phishing_url': '🔗',
    'legitimate_email': '🛡️',
    'legitimate_url': '🔗',
    'trusted': '⭐',
    'uncertain': '❓'
  };

  const titles = {
    'phishing_email': 'Phishing Threat',
    'phishing_url': 'Phishing Link',
    'legitimate_email': 'Safe Email',
    'legitimate_url': 'Safe Link',
    'trusted': 'Trusted Sender',
    'uncertain': 'Uncertain / Review'
  };

  resultIcon.textContent = icons[scanResult.label] || '❓';
  resultLabel.textContent = titles[scanResult.label] || 'Analyzed';
  resultConfidence.textContent = `${Math.round((scanResult.confidence || 0) * 100)}%`;

  resultReasons.textContent = '';
  if (scanResult.reasons && scanResult.reasons.length > 0) {
    scanResult.reasons.forEach(r => {
      const item = document.createElement('div');
      item.className = 'result-reason-item';
      item.textContent = `• ${r}`;
      resultReasons.appendChild(item);
    });
  } else {
    const item = document.createElement('div');
    item.className = 'result-reason-item';
    item.textContent = '• Standard authentic email patterns observed';
    resultReasons.appendChild(item);
  }
}

/**
 * Hide Result Card
 */
function hideResult() {
  resultCard.className = 'result-card';
}

/**
 * Show Error Box
 */
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add('visible');
}

/**
 * Hide Error Box
 */
function hideError() {
  errorBox.textContent = '';
  errorBox.classList.remove('visible');
}

/**
 * Update Setting in Background
 */
async function updateSetting(key, value) {
  currentSettings[key] = value;
  try {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: currentSettings
    });
  } catch (e) {
    logger.error('Failed to update setting:', e);
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);