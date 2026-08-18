/**
 * PhishNet Content Script
 * Extracts email content from Gmail/Outlook and communicates with background
 */

import { getSelectorsForCurrentSite, EMAIL_SELECTORS, UTILITY_SELECTORS } from './selectors.js';
import logger from './utils/logger.js';

// State
let currentSelectors = null;
let observer = null;
let lastScannedEmailId = null;
let scanDebounceTimer = null;
const SCAN_DEBOUNCE_MS = 500;

/**
 * Initialize content script
 */
function init() {
  currentSelectors = getSelectorsForCurrentSite();

  if (!currentSelectors) {
    logger.debug('Not on supported email provider');
    return;
  }

  logger.debug(`Initialized for ${currentSelectors.provider} (${currentSelectors.variant})`);

  // Start observing for email opens
  startEmailObserver();

  // Listen for messages from background/popup
  chrome.runtime.onMessage.addListener(handleMessage);

  // Notify background that content script is ready
  chrome.runtime.sendMessage({ type: 'CONTENT_READY', provider: currentSelectors.provider });
}

/**
 * Start MutationObserver to detect email opens
 */
function startEmailObserver() {
  const selectors = currentSelectors.selectors;

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        checkForNewEmails();
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initial check
  checkForNewEmails();
}

/**
 * Check for newly opened emails
 */
function checkForNewEmails() {
  const selectors = currentSelectors.selectors;
  const messageElements = document.querySelectorAll(selectors.messages);

  messageElements.forEach((element) => {
    const emailId = getEmailId(element);
    if (emailId && emailId !== lastScannedEmailId) {
      debouncedScanEmail(element, emailId);
    }
  });
}

/**
 * Get unique email identifier
 */
function getEmailId(element) {
  const selectors = currentSelectors.selectors;

  // Try data attributes first
  if (element.dataset.messageId) return element.dataset.messageId;
  if (element.dataset.convid) return element.dataset.convid;

  // Fallback: generate from content
  const senderEl = element.querySelector(selectors.sender) ||
                   element.querySelector(selectors.senderEmail);
  const subjectEl = element.querySelector(selectors.subject) ||
                    element.querySelector(selectors.subjectAlt);

  if (senderEl && subjectEl) {
    return btoa(senderEl.textContent + subjectEl.textContent).slice(0, 32);
  }

  return null;
}

/**
 * Debounced email scanning
 */
function debouncedScanEmail(element, emailId) {
  clearTimeout(scanDebounceTimer);
  scanDebounceTimer = setTimeout(() => {
    scanEmail(element, emailId);
  }, SCAN_DEBOUNCE_MS);
}

/**
 * Extract and scan email content
 */
async function scanEmail(element, emailId) {
  try {
    const emailContent = extractEmailContent(element);

    if (!emailContent.text || emailContent.text.length < 20) {
      logger.debug('Email too short, skipping');
      return;
    }

    lastScannedEmailId = emailId;

    // Send to background for classification
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_EMAIL',
      payload: {
        ...emailContent,
        url: window.location.href,
        emailId
      }
    });

    if (response && response.success) {
      injectBadge(element, response.result);
      highlightLinks(element, response.result);
    }
  } catch (error) {
    logger.error('Scan failed:', error);
  }
}

/**
 * Extract email content from DOM element
 */
function extractEmailContent(element) {
  const selectors = currentSelectors.selectors;

  // Extract subject
  let subject = '';
  const subjectEl = element.querySelector(selectors.subject) ||
                    element.querySelector(selectors.subjectAlt) ||
                    element.querySelector(selectors.subjectFallback);
  if (subjectEl) subject = subjectEl.textContent.trim();

  // Extract sender
  let senderName = '', senderEmail = '', senderDomain = '';
  const senderEl = element.querySelector(selectors.sender);
  const senderEmailEl = element.querySelector(selectors.senderEmail) ||
                        element.querySelector(selectors.senderFallback);

  if (senderEl) senderName = senderEl.textContent.trim();
  if (senderEmailEl) {
    senderEmail = senderEmailEl.textContent.trim();
    senderEmail = senderEmail.replace(/[<>"]/g, '').trim();
    const match = senderEmail.match(/@([^@]+)$/);
    if (match) senderDomain = match[1].toLowerCase();
  }

  // Fallback: try to get sender from combined element
  if (!senderEmail && senderEl) {
    const emailAttr = senderEl.getAttribute('email');
    if (emailAttr) {
      senderEmail = emailAttr;
      const match = senderEmail.match(/@([^@]+)$/);
      if (match) senderDomain = match[1].toLowerCase();
    }
  }

  // Extract body text
  let bodyText = '';
  const bodyEl = element.querySelector(selectors.messageBody) ||
                 element.querySelector(selectors.messageBodyAlt) ||
                 element.querySelector(selectors.messageBodyFallback);

  if (bodyEl) {
    // Clone to avoid modifying original
    const clone = bodyEl.cloneNode(true);

    // Remove skip elements
    UTILITY_SELECTORS.skipElements.forEach(skipSel => {
      clone.querySelectorAll(skipSel).forEach(el => el.remove());
    });

    // Get text content
    bodyText = clone.textContent.trim();

    // Limit length
    if (bodyText.length > 3000) {
      bodyText = bodyText.slice(0, 3000);
    }
  }

  // Extract links
  const links = extractLinks(element);

  // Combine subject + body for classification
  const fullText = `${subject}\n\n${bodyText}`.trim();

  return {
    text: fullText,
    subject,
    body: bodyText,
    links,
    sender: {
      name: senderName,
      email: senderEmail,
      domain: senderDomain
    }
  };
}

/**
 * Extract all links from email
 */
function extractLinks(element) {
  const selectors = currentSelectors.selectors;
  const links = [];

  const linkElements = element.querySelectorAll(selectors.links);

  linkElements.forEach((linkEl) => {
    const href = linkEl.getAttribute('href');
    if (!href) return;

    // Skip non-http links
    if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
      return;
    }

    let text = linkEl.textContent.trim();
    if (!text) {
      // Try to get text from child elements
      const textEl = linkEl.querySelector(selectors.linkText);
      if (textEl) text = textEl.textContent.trim();
    }

    // Limit text length
    if (text.length > 100) text = text.slice(0, 100) + '...';

    // Heuristic: check if suspicious
    const suspicious = isLinkSuspicious(href, text);

    links.push({ href, text, suspicious });
  });

  return links;
}

/**
 * Heuristic link analysis
 */
function isLinkSuspicious(href, text) {
  try {
    const url = new URL(href);
    const domain = url.hostname.toLowerCase();

    // Check suspicious TLDs
    for (const tld of UTILITY_SELECTORS.suspiciousTlds) {
      if (domain.endsWith(tld)) return true;
    }

    // Check URL shorteners
    for (const shortener of UTILITY_SELECTORS.urlShorteners) {
      if (domain.includes(shortener)) return true;
    }

    // Check for mismatched display text (text looks like URL but differs from href)
    if (text.match(/^https?:\/\//) && text !== href) {
      const textDomain = new URL(text).hostname;
      if (textDomain !== domain) return true;
    }

    // Check for IP address instead of domain
    if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return true;

    // Check for excessive subdomains
    if (domain.split('.').length > 4) return true;

    // Check for suspicious keywords in domain
    const suspiciousKeywords = ['secure', 'verify', 'account', 'login', 'signin', 'update', 'confirm'];
    for (const kw of suspiciousKeywords) {
      if (domain.includes(kw) && !domain.startsWith(kw + '.')) return true;
    }

  } catch (e) {
    // Invalid URL
    return true;
  }

  return false;
}

/**
 * Inject classification badge into email
 */
function injectBadge(element, result) {
  // Remove existing badge
  const existingBadge = element.querySelector('.phishnet-badge');
  if (existingBadge) existingBadge.remove();

  const selectors = currentSelectors.selectors;

  // Find insertion point (near sender or subject)
  let insertPoint = element.querySelector(selectors.sender) ||
                    element.querySelector(selectors.senderEmail) ||
                    element.querySelector(selectors.subject) ||
                    element.querySelector(selectors.subjectAlt);

  if (!insertPoint) return;

  // Create badge
  const badge = document.createElement('span');
  badge.className = `phishnet-badge phishnet-badge--${result.label}`;
  badge.setAttribute('data-confidence', result.confidence.toFixed(2));
  badge.setAttribute('data-email-id', getEmailId(element) || '');

  // Badge icons and labels
  const badgeConfig = {
    'phishing_email': { icon: '⚠️', label: 'Phishing', class: 'phishnet-badge--phishing' },
    'phishing_url': { icon: '🔗', label: 'Phishing Link', class: 'phishnet-badge--phishing' },
    'legitimate_email': { icon: '🛡️', label: 'Safe', class: 'phishnet-badge--safe' },
    'legitimate_url': { icon: '🔗', label: 'Safe Link', class: 'phishnet-badge--safe' },
    'uncertain': { icon: '❓', label: 'Uncertain', class: 'phishnet-badge--uncertain' }
  };

  const config = badgeConfig[result.label] || badgeConfig.uncertain;
  badge.className = `phishnet-badge ${config.class}`;
  badge.innerHTML = `${config.icon} ${config.label} (${(result.confidence * 100).toFixed(0)}%)`;

  // Add tooltip
  badge.title = generateTooltip(result);
  badge.classList.add('phishnet-tooltip-trigger');

  // Insert after sender/subject
  insertPoint.parentNode.insertBefore(badge, insertPoint.nextSibling);

  // Add tooltip styles if not present
  ensureTooltipStyles();
}

/**
 * Generate tooltip content
 */
function generateTooltip(result) {
  const lines = [
    `Confidence: ${(result.confidence * 100).toFixed(1)}%`,
    ''
  ];

  if (result.reasons && result.reasons.length > 0) {
    lines.push('Reasons:');
    result.reasons.forEach(r => lines.push(`• ${r}`));
  }

  if (result.processingTime) {
    lines.push(`\nProcessed in ${result.processingTime}ms`);
  }

  return lines.join('\n');
}

/**
 * Highlight suspicious links
 */
function highlightLinks(element, result) {
  const selectors = currentSelectors.selectors;
  const links = element.querySelectorAll(selectors.links);

  links.forEach((linkEl) => {
    const href = linkEl.getAttribute('href');
    if (!href) return;

    // Check if this link was flagged
    const isSuspicious = result.links?.some(l => l.href === href && l.suspicious) ||
                         isLinkSuspicious(href, linkEl.textContent);

    if (isSuspicious) {
      linkEl.classList.add('phishnet-link--suspicious');

      // Add warning indicator
      if (!linkEl.querySelector('.phishnet-link-warning')) {
        const warning = document.createElement('span');
        warning.className = 'phishnet-link-warning';
        warning.textContent = ' ⚠️';
        warning.style.marginLeft = '4px';
        warning.style.fontSize = '0.8em';
        linkEl.appendChild(warning);
      }
    }
  });
}

/**
 * Ensure tooltip CSS is injected
 */
function ensureTooltipStyles() {
  if (document.getElementById('phishnet-tooltip-styles')) return;

  const style = document.createElement('style');
  style.id = 'phishnet-tooltip-styles';
  style.textContent = `
    .phishnet-tooltip-trigger {
      position: relative;
      cursor: help;
    }
    .phishnet-tooltip-trigger:hover::after {
      content: attr(title);
      position: absolute;
      bottom: 120%;
      left: 50%;
      transform: translateX(-50%);
      background: #1f2937;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11px;
      max-width: 280px;
      white-space: pre-wrap;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      line-height: 1.4;
    }
    .phishnet-tooltip-trigger:hover::before {
      content: '';
      position: absolute;
      bottom: 110%;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: #1f2937;
      z-index: 10000;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Handle messages from background/popup
 */
function handleMessage(message, sender, sendResponse) {
  switch (message.type) {
    case 'SCAN_CURRENT_EMAIL':
      // Manual scan from popup
      const selectors = currentSelectors.selectors;
      const messageElements = document.querySelectorAll(selectors.messages);
      if (messageElements.length > 0) {
        const latestEmail = messageElements[messageElements.length - 1];
        const emailId = getEmailId(latestEmail) || 'manual-' + Date.now();
        scanEmail(latestEmail, emailId).then(() => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: false, error: 'No email found' });
      }
      return true; // Async response

    case 'GET_SETTINGS':
      // Forward to background
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }).then(response => {
        sendResponse(response);
      });
      return true;

    case 'MODEL_STATUS':
      // Update UI based on model status
      updateModelStatusUI(message.payload);
      break;
  }
}

/**
 * Update UI based on model loading status
 */
function updateModelStatusUI(status) {
  // Could show a temporary indicator in the email list
  logger.debug('Model status:', status);
}

/**
 * Cleanup on unload
 */
window.addEventListener('beforeunload', () => {
  if (observer) observer.disconnect();
  clearTimeout(scanDebounceTimer);
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Also handle SPA navigation (Gmail/Outlook are SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    lastScannedEmailId = null; // Reset to allow re-scanning
    setTimeout(checkForNewEmails, 1000); // Wait for DOM to settle
  }
}).observe(document, { subtree: true, childList: true });