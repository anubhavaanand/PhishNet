/**
 * PhishNet Content Script
 * Extracts email content from Gmail/Outlook and coordinates scanning with background worker
 */

(function () {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  const PhishNet = root.PhishNet || {};

  const logger = PhishNet.logger || {
    debug: () => {},
    info: () => {},
    warn: (...args) => console.warn('[PhishNet]', ...args),
    error: (...args) => console.error('[PhishNet]', ...args)
  };

  const getSelectorsForCurrentSite = PhishNet.getSelectorsForCurrentSite || (() => null);
  const UTILITY_SELECTORS = PhishNet.UTILITY_SELECTORS || { skipElements: [], suspiciousTlds: [], urlShorteners: [] };
  const heuristicDetect = PhishNet.heuristicDetect || (() => ({ label: 'uncertain', confidence: 0.5, reasons: [] }));
  const safeQuery = PhishNet.safeQuery || ((el, sel) => el ? el.querySelector(Array.isArray(sel) ? sel[0] : sel) : null);
  const safeText = PhishNet.safeText || ((el, max = 3000) => (el?.textContent || '').trim().slice(0, max));
  const safeAttr = PhishNet.safeAttr || ((el, attr, fb = '') => el?.getAttribute(attr) || fb);

  // State
  let currentSelectors = null;
  let observer = null;
  let lastScannedEmailId = null;
  let scanDebounceTimer = null;
  let lastUrl = typeof location !== 'undefined' ? location.href : '';
  const activeScans = new Set();
  const SCAN_DEBOUNCE_MS = 400;

  /**
   * Initialize content script
   */
  function init() {
    currentSelectors = getSelectorsForCurrentSite();

    if (!currentSelectors) {
      logger.debug('Not on a supported email provider');
      return;
    }

    logger.debug(`Initialized for ${currentSelectors.provider} (${currentSelectors.variant})`);

    // Start consolidated observer
    startEmailObserver();

    // Listen for messages from background/popup
    chrome.runtime.onMessage.addListener(handleMessage);

    // Notify background that content script is ready
    chrome.runtime.sendMessage({ type: 'CONTENT_READY', provider: currentSelectors.provider }).catch(() => {});
  }

  /**
   * Consolidated MutationObserver to detect both email opens and SPA navigation
   */
  function startEmailObserver() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(() => {
      // Check SPA navigation
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        lastScannedEmailId = null;
        debouncedCheckForNewEmails(800);
        return;
      }

      debouncedCheckForNewEmails(SCAN_DEBOUNCE_MS);
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Initial check
    checkForNewEmails();
  }

  /**
   * Debounced check for new emails
   */
  function debouncedCheckForNewEmails(delay = SCAN_DEBOUNCE_MS) {
    clearTimeout(scanDebounceTimer);
    scanDebounceTimer = setTimeout(() => {
      checkForNewEmails();
    }, delay);
  }

  /**
   * Check for newly opened emails in the DOM
   */
  function checkForNewEmails() {
    if (!currentSelectors || !currentSelectors.selectors) return;
    const selectors = currentSelectors.selectors;
    const messageElements = document.querySelectorAll(selectors.messages);

    if (messageElements.length === 0) return;

    messageElements.forEach((element) => {
      const emailId = getEmailId(element);
      if (emailId && emailId !== lastScannedEmailId && !activeScans.has(emailId)) {
        scanEmail(element, emailId);
      }
    });
  }

  /**
   * Get unique email identifier
   */
  function getEmailId(element) {
    if (!element) return null;
    const selectors = currentSelectors?.selectors;

    // Try standard data attributes
    if (element.dataset?.messageId) return element.dataset.messageId;
    if (element.dataset?.convid) return element.dataset.convid;

    // Fallback: hash/encode sender + subject
    if (selectors) {
      const senderEl = element.querySelector(selectors.sender) || element.querySelector(selectors.senderEmail);
      const subjectEl = element.querySelector(selectors.subject) || element.querySelector(selectors.subjectAlt);

      if (senderEl || subjectEl) {
        const str = (senderEl?.textContent || '') + '::' + (subjectEl?.textContent || '');
        try {
          return btoa(unescape(encodeURIComponent(str))).slice(0, 32);
        } catch (e) {
          return str.slice(0, 32);
        }
      }
    }

    return null;
  }

  /**
   * Extract and scan email content
   * Returns scan result object
   */
  async function scanEmail(element, emailId) {
    if (!element) return null;
    if (emailId && activeScans.has(emailId)) return null;

    if (emailId) {
      activeScans.add(emailId);
    }

    try {
      const emailContent = extractEmailContent(element);

      if (!emailContent.text || emailContent.text.length < 15) {
        logger.debug('Email content too short, skipping scan');
        return null;
      }

      lastScannedEmailId = emailId;

      // Get current settings for threshold
      let settings = { autoScan: true, sensitivityThreshold: 0.7, highlightLinks: true, showTooltip: true };
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        if (response) settings = Object.assign(settings, response);
      } catch (e) {
        logger.debug('Using default settings for scan');
      }

      // If auto-scan is disabled and this wasn't an explicit scan, skip
      if (!settings.autoScan && !emailId?.startsWith('manual-')) {
        return null;
      }

      // Attempt ML classification via background worker
      let mlResult = null;
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'SCAN_EMAIL',
          payload: {
            ...emailContent,
            url: window.location.href,
            emailId
          }
        });

        if (response && response.success && response.result) {
          mlResult = response.result;
        }
      } catch (mlError) {
        logger.debug('ML inference unavailable, applying heuristic detection');
      }

      // Use ML result if available, otherwise heuristic detection
      const result = mlResult || heuristicDetect(emailContent, emailContent.links);

      // Apply sensitivity threshold adjustments
      if (result.confidence < settings.sensitivityThreshold && result.label === 'phishing_email') {
        result.label = 'uncertain';
        result.reasons = result.reasons || [];
        result.reasons.unshift(`Confidence (${Math.round(result.confidence * 100)}%) is below sensitivity threshold (${Math.round(settings.sensitivityThreshold * 100)}%)`);
      }

      // Inject UI indicators
      injectBadge(element, result);
      if (settings.highlightLinks) {
        highlightLinks(element, result);
      }

      return result;
    } catch (error) {
      logger.error('Email scan error:', error);
      return null;
    } finally {
      if (emailId) {
        activeScans.delete(emailId);
      }
    }
  }

  /**
   * Extract email content from DOM element with robust fallbacks
   */
  function extractEmailContent(element) {
    const selectors = currentSelectors?.selectors || {};

    // Extract subject
    const subjectSelectors = [
      selectors.subject,
      selectors.subjectAlt,
      selectors.subjectFallback,
      'h2[data-thread-id]',
      'h2', 'h3', '[role="heading"]',
      '[data-thread-id] h2', '[data-thread-id] h3'
    ].filter(Boolean);
    const subjectEl = safeQuery(element.closest('[data-thread-id]') || element.closest('[data-convid]') || document, subjectSelectors, 'Subject');
    const subject = safeText(subjectEl);

    // Extract sender
    let senderName = '', senderEmail = '', senderDomain = '';
    const senderSelectors = [
      selectors.sender,
      selectors.senderName,
      selectors.senderEmail,
      selectors.senderFallback,
      '[email]', '[data-email]', '.sender', '.from', '[data-testid="message-header-sender-name"]'
    ].filter(Boolean);
    const senderEl = safeQuery(element, senderSelectors, 'Sender');

    if (senderEl) {
      senderName = safeText(senderEl);
      const emailAttr = safeAttr(senderEl, 'email') || safeAttr(senderEl, 'data-email') || safeAttr(senderEl, 'title');
      if (emailAttr && emailAttr.includes('@')) {
        senderEmail = emailAttr.replace(/[<>"]/g, '').trim();
      } else if (senderName.includes('@')) {
        senderEmail = senderName.replace(/[<>"]/g, '').trim();
      }
      if (senderEmail) {
        const match = senderEmail.match(/@([^@\s>]+)/);
        if (match) senderDomain = match[1].toLowerCase();
      }
    }

    // Extract body text
    let bodyText = '';
    const bodySelectors = [
      selectors.messageBody,
      selectors.messageBodyAlt,
      selectors.messageBodyFallback,
      '[data-message-id] .ii.gt',
      '[data-message-id] .a3s',
      '[data-testid="message-body-content"]',
      '[data-testid="message-body"]',
      '.elementToProof',
      '.allowTextSelection',
      '.message-body',
      '.email-body',
      '[role="main"]',
      'article'
    ].filter(Boolean);

    const bodyEl = safeQuery(element, bodySelectors, 'Body') || element;

    if (bodyEl) {
      // Lightweight clone for stripping ignore nodes
      try {
        const clone = bodyEl.cloneNode(true);
        const skipList = (UTILITY_SELECTORS.skipElements || []).concat([
          'script', 'style', 'noscript', '.phishnet-badge', '.phishnet-link-warning'
        ]);
        skipList.forEach((sel) => {
          try {
            clone.querySelectorAll(sel).forEach(el => el.remove());
          } catch (e) {}
        });
        bodyText = safeText(clone, 4000);
      } catch (e) {
        bodyText = safeText(bodyEl, 4000);
      }
    }

    // Extract links
    const links = extractLinks(element);

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
    const selectors = currentSelectors?.selectors || {};
    const linkQuery = selectors.links || 'a[href]';
    const links = [];

    const linkElements = element.querySelectorAll(linkQuery);

    linkElements.forEach((linkEl) => {
      const href = linkEl.getAttribute('href');
      if (!href) return;

      if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
        return;
      }

      let text = (linkEl.textContent || '').trim();
      if (text.length > 120) text = text.slice(0, 120) + '...';

      const isSuspicious = PhishNet.isUrlSuspicious ? PhishNet.isUrlSuspicious(href) : false;

      links.push({ href, text, suspicious: isSuspicious });
    });

    return links;
  }

  /**
   * Inject classification badge into email header
   */
  function injectBadge(element, result) {
    if (!element || !result) return;

    // Remove any existing badge
    const existing = element.querySelector('.phishnet-badge');
    if (existing) existing.remove();

    const selectors = currentSelectors?.selectors || {};

    const insertPoint = element.querySelector(selectors.sender) ||
                        element.querySelector(selectors.senderEmail) ||
                        element.querySelector(selectors.subject) ||
                        element.querySelector(selectors.subjectAlt) ||
                        element.querySelector('h2, h3, [role="heading"]');

    if (!insertPoint || !insertPoint.parentNode) return;

    const badgeConfig = {
      'phishing_email': { icon: '⚠️', label: 'Phishing', class: 'phishnet-badge--phishing' },
      'phishing_url': { icon: '🔗', label: 'Phishing Link', class: 'phishnet-badge--phishing' },
      'legitimate_email': { icon: '🛡️', label: 'Safe', class: 'phishnet-badge--safe' },
      'legitimate_url': { icon: '🔗', label: 'Safe Link', class: 'phishnet-badge--safe' },
      'uncertain': { icon: '❓', label: 'Uncertain', class: 'phishnet-badge--uncertain' }
    };

    const config = badgeConfig[result.label] || badgeConfig.uncertain;
    const confidencePct = Math.round((result.confidence || 0) * 100);

    const badge = document.createElement('span');
    badge.className = `phishnet-badge ${config.class} phishnet-tooltip-trigger`;
    badge.setAttribute('data-confidence', String(result.confidence || 0));
    badge.setAttribute('data-tooltip', generateTooltip(result));
    badge.setAttribute('title', generateTooltip(result));
    badge.textContent = `${config.icon} ${config.label} (${confidencePct}%)`;

    insertPoint.parentNode.insertBefore(badge, insertPoint.nextSibling);
    ensureTooltipStyles();
  }

  /**
   * Generate tooltip text
   */
  function generateTooltip(result) {
    const confidencePct = ((result.confidence || 0) * 100).toFixed(1);
    const lines = [`Confidence: ${confidencePct}%`];

    if (result.reasons && result.reasons.length > 0) {
      lines.push('');
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
    if (!element) return;
    const selectors = currentSelectors?.selectors || {};
    const linkQuery = selectors.links || 'a[href]';
    const links = element.querySelectorAll(linkQuery);

    links.forEach((linkEl) => {
      const href = linkEl.getAttribute('href');
      if (!href) return;

      const flaggedInResult = result?.links?.some(l => l.href === href && l.suspicious);
      const isSuspicious = flaggedInResult || (PhishNet.isUrlSuspicious ? PhishNet.isUrlSuspicious(href) : false);

      if (isSuspicious) {
        linkEl.classList.add('phishnet-link--suspicious');
        linkEl.classList.add('phishnet-tooltip-trigger');

        const tooltipMsg = `Suspicious link: ${href.slice(0, 80)}`;
        linkEl.setAttribute('data-phishnet-tooltip', tooltipMsg);
        linkEl.setAttribute('data-tooltip', tooltipMsg);
        linkEl.setAttribute('title', tooltipMsg);

        if (!linkEl.querySelector('.phishnet-link-warning')) {
          const warning = document.createElement('span');
          warning.className = 'phishnet-link-warning';
          warning.textContent = '⚠️';
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
      .phishnet-tooltip-trigger { position: relative; cursor: help; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  /**
   * Handle incoming runtime messages
   */
  function handleMessage(message, sender, sendResponse) {
    if (!message || !message.type) return;

    switch (message.type) {
      case 'SCAN_CURRENT_EMAIL': {
        const selectors = currentSelectors?.selectors || {};
        const messageElements = document.querySelectorAll(selectors.messages || '[data-message-id]');
        if (messageElements.length > 0) {
          const latestEmail = messageElements[messageElements.length - 1];
          const emailId = 'manual-' + Date.now();
          scanEmail(latestEmail, emailId).then((result) => {
            if (result) {
              sendResponse({ success: true, result });
            } else {
              sendResponse({ success: false, error: 'Could not extract email content' });
            }
          }).catch((err) => {
            sendResponse({ success: false, error: err.message });
          });
        } else {
          sendResponse({ success: false, error: 'No opened email found on page' });
        }
        return true;
      }

      case 'GET_SETTINGS': {
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }).then(sendResponse).catch(() => {
          sendResponse({ autoScan: true, sensitivityThreshold: 0.7, highlightLinks: true });
        });
        return true;
      }

      case 'SETTINGS_UPDATE':
      case 'MODEL_STATUS':
        break;
    }
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (observer) observer.disconnect();
    clearTimeout(scanDebounceTimer);
  });

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();