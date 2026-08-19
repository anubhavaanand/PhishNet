/**
 * PhishNet Error Boundary Utilities
 * Graceful error handling and recovery for content script
 */

(function () {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  const logger = root.PhishNet?.logger || {
    debug: () => {},
    info: () => {},
    warn: (...args) => console.warn('[PhishNet]', ...args),
    error: (...args) => console.error('[PhishNet]', ...args)
  };

  /**
   * Wrap async function with error boundary
   */
  function withErrorBoundary(fn, context = 'Operation') {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        logger.error(`${context} failed:`, error);
        return { error: error.message, failed: true };
      }
    };
  }

  /**
   * Retry with exponential backoff
   */
  async function retryWithBackoff(fn, maxAttempts = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  /**
   * Safe DOM query with fallback
   */
  function safeQuery(element, selectors, context = 'Element') {
    if (!element) return null;
    
    const selectorList = Array.isArray(selectors) ? selectors : [selectors];
    
    for (const selector of selectorList) {
      try {
        const found = element.querySelector(selector);
        if (found) return found;
      } catch (e) {
        logger.debug(`${context}: selector "${selector}" failed:`, e.message);
      }
    }
    return null;
  }

  /**
   * Safe text extraction
   */
  function safeText(element, maxLength = 3000) {
    if (!element) return '';
    try {
      const text = element.textContent?.trim() || '';
      return text.length > maxLength ? text.slice(0, maxLength) : text;
    } catch (e) {
      logger.debug('Text extraction failed:', e.message);
      return '';
    }
  }

  /**
   * Safe attribute extraction
   */
  function safeAttr(element, attr, fallback = '') {
    if (!element) return fallback;
    try {
      return element.getAttribute(attr) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  /**
   * Debounce function
   */
  function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Throttle function
   */
  function throttle(fn, limit) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Generate unique ID
   */
  function generateId(prefix = 'phishnet') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Check if element is visible
   */
  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
  }

  /**
   * Safe message send with timeout
   */
  function safeSendMessage(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Message timeout')), timeout);
      
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Safe tab query
   */
  function safeQueryTabs(queryInfo) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query(queryInfo, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(tabs);
        }
      });
    });
  }

  /**
   * Safe tab message send
   */
  function safeTabSendMessage(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Attach to global PhishNet namespace
  root.PhishNet = root.PhishNet || {};
  Object.assign(root.PhishNet, {
    withErrorBoundary,
    retryWithBackoff,
    safeQuery,
    safeText,
    safeAttr,
    debounce,
    throttle,
    generateId,
    isVisible,
    safeSendMessage,
    safeQueryTabs,
    safeTabSendMessage
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      withErrorBoundary,
      retryWithBackoff,
      safeQuery,
      safeText,
      safeAttr,
      debounce,
      throttle,
      generateId,
      isVisible,
      safeSendMessage,
      safeQueryTabs,
      safeTabSendMessage
    };
  }
})();