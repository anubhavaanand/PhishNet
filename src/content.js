/**
 * PhishNet Content Script
 * Extracts email content, attachments, and links from Gmail/Outlook; coordinates scanning and threat modals
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
  const UTILITY_SELECTORS = PhishNet.UTILITY_SELECTORS || { skipElements: [] };
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

    if (element.dataset?.messageId) return element.dataset.messageId;
    if (element.dataset?.convid) return element.dataset.convid;

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

      // Check user settings & whitelist
      let settings = { autoScan: true, sensitivityThreshold: 0.7, highlightLinks: true, showTooltip: true, whitelist: [] };
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        if (response) settings = Object.assign(settings, response);
      } catch (e) {
        logger.debug('Using default settings for scan');
      }

      // Check Whitelist
      const senderEmail = emailContent.sender?.email?.toLowerCase() || '';
      const senderDomain = emailContent.sender?.domain?.toLowerCase() || '';
      const whitelist = settings.whitelist || [];

      const isWhitelisted = whitelist.some(item => {
        const clean = item.toLowerCase().trim();
        return clean && (clean === senderEmail || clean === senderDomain || senderEmail.endsWith('@' + clean));
      });

      if (isWhitelisted) {
        const trustedResult = {
          label: 'trusted',
          confidence: 1.0,
          reasons: ['Sender is on your Trusted Senders whitelist'],
          processingTime: 0,
          links: emailContent.links,
          attachments: emailContent.attachments,
          emailContent
        };
        injectBadge(element, trustedResult);
        logScanRecord(emailContent, trustedResult);
        return trustedResult;
      }

      if (!settings.autoScan && !emailId?.startsWith('manual-')) {
        return null;
      }

      // Run ML classification via background worker
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

      // Fallback to advanced heuristic detector
      const heuristicRes = heuristicDetect(emailContent, emailContent.links, emailContent.attachments);
      const result = mlResult ? Object.assign({}, heuristicRes, mlResult, {
        links: heuristicRes.links,
        attachments: heuristicRes.attachments,
        signals: heuristicRes.signals
      }) : heuristicRes;

      result.emailContent = emailContent;

      // Apply sensitivity threshold
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

      // Log locally for popup stats
      logScanRecord(emailContent, result);

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
   * Log scan result to chrome.storage.local for dashboard
   */
  function logScanRecord(emailContent, result) {
    if (!chrome.storage?.local) return;

    try {
      chrome.storage.local.get(['scanHistory', 'scanStats'], (data) => {
        const history = data.scanHistory || [];
        const stats = data.scanStats || { total: 0, phishing: 0, safe: 0, uncertain: 0, trusted: 0 };

        stats.total++;
        if (result.label === 'phishing_email') stats.phishing++;
        else if (result.label === 'legitimate_email') stats.safe++;
        else if (result.label === 'trusted') stats.trusted++;
        else stats.uncertain++;

        const newRecord = {
          id: Date.now(),
          subject: (emailContent.subject || 'No Subject').slice(0, 80),
          sender: emailContent.sender?.email || emailContent.sender?.domain || 'Unknown',
          label: result.label,
          confidence: Math.round((result.confidence || 0) * 100),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const updatedHistory = [newRecord, ...history.slice(0, 19)]; // Keep latest 20
        chrome.storage.local.set({ scanHistory: updatedHistory, scanStats: stats }).catch(() => {});
      });
    } catch (e) {}
  }

  /**
   * Extract email content and attachments from DOM element
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
      '[data-thread-id] h2'
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

    // Extract attachments
    const attachments = extractAttachments(element);

    const fullText = `${subject}\n\n${bodyText}`.trim();

    return {
      text: fullText,
      subject,
      body: bodyText,
      links,
      attachments,
      sender: {
        name: senderName,
        email: senderEmail,
        domain: senderDomain
      }
    };
  }

  /**
   * Extract links from email
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
   * Extract attachment filenames from email
   */
  function extractAttachments(element) {
    const selectors = currentSelectors?.selectors || {};
    const attachments = [];
    const attSelectors = [
      selectors.attachmentNames,
      selectors.attachments,
      '[data-testid*="attachment"]',
      '[download_url]',
      '.aZo'
    ].filter(Boolean);

    attSelectors.forEach(sel => {
      try {
        element.querySelectorAll(sel).forEach(el => {
          const name = el.getAttribute('title') || el.getAttribute('download') || el.textContent || '';
          const clean = name.trim();
          if (clean && clean.length < 100 && clean.includes('.') && !attachments.includes(clean)) {
            attachments.push(clean);
          }
        });
      } catch (e) {}
    });

    return attachments;
  }

  /**
   * Inject classification badge into email header
   */
  function injectBadge(element, result) {
    if (!element || !result) return;

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
      'trusted': { icon: '⭐', label: 'Trusted Sender', class: 'phishnet-badge--trusted' },
      'uncertain': { icon: '❓', label: 'Uncertain', class: 'phishnet-badge--uncertain' }
    };

    const config = badgeConfig[result.label] || badgeConfig.uncertain;
    const confidencePct = Math.round((result.confidence || 0) * 100);

    const badge = document.createElement('span');
    badge.className = `phishnet-badge ${config.class} phishnet-tooltip-trigger`;
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('aria-label', `${config.label} (${confidencePct}%) - Click or press Enter for threat details`);
    badge.setAttribute('data-confidence', String(result.confidence || 0));
    badge.setAttribute('data-tooltip', `${config.label} (${confidencePct}%) • Click for Threat Details`);
    badge.textContent = `${config.icon} ${config.label} (${confidencePct}%)`;

    // Click or keyboard trigger to open detailed threat breakdown modal
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      openThreatModal(result);
    });
    badge.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.stopPropagation();
        e.preventDefault();
        openThreatModal(result);
      }
    });

    insertPoint.parentNode.insertBefore(badge, insertPoint.nextSibling);
    ensureTooltipStyles();
  }

  /**
   * Interactive Threat Breakdown Modal
   */
  function openThreatModal(result) {
    const existing = document.getElementById('phishnet-modal-root');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'phishnet-modal-root';
    backdrop.className = 'phishnet-modal-backdrop';

    const card = document.createElement('div');
    card.className = 'phishnet-modal-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'phishnet-modal-title-id');

    const header = document.createElement('div');
    header.className = 'phishnet-modal-header';
    header.innerHTML = `
      <div class="phishnet-modal-header-left">
        <span class="phishnet-modal-logo" aria-hidden="true">🎣</span>
        <span class="phishnet-modal-title" id="phishnet-modal-title-id">PhishNet Threat Inspector</span>
      </div>
      <button class="phishnet-modal-close" id="phishnetModalCloseBtn" aria-label="Close threat details dialog">✕</button>
    `;

    const body = document.createElement('div');
    body.className = 'phishnet-modal-body';

    const confidencePct = Math.round((result.confidence || 0) * 100);
    const verdictClass = result.label.includes('phishing') ? 'phishing' : (result.label.includes('legitimate') || result.label === 'trusted' ? 'safe' : 'uncertain');
    const verdictTitle = result.label === 'trusted' ? 'Trusted Sender' : (result.label.includes('phishing') ? 'Phishing Threat Detected' : (result.label.includes('legitimate') ? 'Legitimate Email' : 'Suspicious / Uncertain'));
    const verdictIcon = result.label === 'trusted' ? '⭐' : (result.label.includes('phishing') ? '⚠️' : (result.label.includes('legitimate') ? '🛡️' : '❓'));

    // Verdict Banner
    const verdictBanner = document.createElement('div');
    verdictBanner.className = `phishnet-verdict-banner ${verdictClass}`;
    verdictBanner.innerHTML = `
      <div class="phishnet-verdict-label">
        <span>${verdictIcon}</span>
        <span>${verdictTitle}</span>
      </div>
      <div class="phishnet-verdict-score">${confidencePct}%</div>
    `;
    body.appendChild(verdictBanner);

    // Reasons Card
    if (result.reasons && result.reasons.length > 0) {
      const reasonsCard = document.createElement('div');
      reasonsCard.className = 'phishnet-reasons-card';
      reasonsCard.innerHTML = `<div class="phishnet-reasons-title">Detected Indicators:</div>`;
      result.reasons.forEach(r => {
        const item = document.createElement('div');
        item.className = 'phishnet-reason-item';
        item.textContent = r;
        reasonsCard.appendChild(item);
      });
      body.appendChild(reasonsCard);
    }

    // Signals Card
    if (result.signals) {
      const signalsGrid = document.createElement('div');
      signalsGrid.className = 'phishnet-signals-grid';
      signalsGrid.innerHTML = `
        <div class="phishnet-signal-card">
          <span class="phishnet-signal-title">Urgency Panic Score</span>
          <span class="phishnet-signal-value" style="color: ${result.signals.urgencyScore > 20 ? '#f43f5e' : '#10b981'}">${result.signals.urgencyScore}/40</span>
        </div>
        <div class="phishnet-signal-card">
          <span class="phishnet-signal-title">Domain Trust Risk</span>
          <span class="phishnet-signal-value" style="color: ${result.signals.senderTrustScore > 20 ? '#f43f5e' : '#10b981'}">${result.signals.senderTrustScore}/45</span>
        </div>
        <div class="phishnet-signal-card">
          <span class="phishnet-signal-title">Link Threat Level</span>
          <span class="phishnet-signal-value" style="color: ${result.signals.linkRiskScore > 0 ? '#f43f5e' : '#10b981'}">${result.signals.linkRiskScore}/45</span>
        </div>
        <div class="phishnet-signal-card">
          <span class="phishnet-signal-title">Attachment Safety</span>
          <span class="phishnet-signal-value" style="color: ${result.signals.attachmentRiskScore > 0 ? '#f43f5e' : '#10b981'}">${result.signals.attachmentRiskScore > 0 ? 'Threat Detected' : 'Clean'}</span>
        </div>
      `;
      body.appendChild(signalsGrid);
    }

    // Link Inspector
    if (result.links && result.links.length > 0) {
      const linkSection = document.createElement('div');
      linkSection.className = 'phishnet-reasons-card';
      linkSection.innerHTML = `<div class="phishnet-reasons-title">Links in Email (${result.links.length}):</div>`;
      const linkList = document.createElement('div');
      linkList.className = 'phishnet-link-list';

      result.links.slice(0, 6).forEach(link => {
        const item = document.createElement('div');
        item.className = `phishnet-link-item ${link.suspicious ? 'suspicious' : ''}`;

        // Security: Avoid innerHTML with unescaped link.href to prevent DOM XSS
        const urlSpan = document.createElement('span');
        urlSpan.className = 'phishnet-link-url';
        urlSpan.title = link.href;
        urlSpan.textContent = link.href;

        const badgeSpan = document.createElement('span');
        badgeSpan.style.fontSize = '10px';
        badgeSpan.style.fontWeight = '700';
        badgeSpan.style.color = link.suspicious ? '#f43f5e' : '#10b981';
        badgeSpan.textContent = link.suspicious ? '⚠️ Suspicious' : '✓ Safe';

        item.appendChild(urlSpan);
        item.appendChild(badgeSpan);
        linkList.appendChild(item);
      });
      linkSection.appendChild(linkList);
      body.appendChild(linkSection);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'phishnet-modal-footer';

    const senderEmail = result.emailContent?.sender?.email || '';
    const whitelistBtn = document.createElement('button');
    whitelistBtn.className = 'phishnet-btn phishnet-btn--secondary';
    whitelistBtn.textContent = '⭐ Whitelist Sender';
    whitelistBtn.addEventListener('click', async () => {
      if (!senderEmail) return;
      chrome.runtime.sendMessage({
        type: 'ADD_WHITELIST',
        entry: senderEmail
      }).then(() => {
        whitelistBtn.textContent = '✓ Whitelisted!';
        whitelistBtn.disabled = true;
      });
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'phishnet-btn phishnet-btn--primary';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => backdrop.remove());

    footer.appendChild(whitelistBtn);
    footer.appendChild(closeBtn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    backdrop.appendChild(card);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    document.addEventListener('keydown', function escListener(e) {
      if (e.key === 'Escape') {
        backdrop.remove();
        document.removeEventListener('keydown', escListener);
      }
    });

    (document.body || document.documentElement).appendChild(backdrop);
    document.getElementById('phishnetModalCloseBtn')?.addEventListener('click', () => backdrop.remove());
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
    style.textContent = `.phishnet-tooltip-trigger { position: relative; }`;
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

  // Cleanup on unload
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