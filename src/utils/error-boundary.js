/**
 * PhishNet Error Boundary Utilities
 * Graceful error handling and recovery for content script
 */

import logger from './logger.js';

/**
 * Wrap async function with error boundary
 */
export function withErrorBoundary(fn, context = 'Operation') {
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
export async function retryWithBackoff(fn, maxAttempts = 3, baseDelay = 1000) {
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
export function safeQuery(element, selectors, context = 'Element') {
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
export function safeText(element, maxLength = 3000) {
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
export function safeAttr(element, attr, fallback = '') {
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
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle(fn, limit) {
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
export function generateId(prefix = 'phishnet') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Check if element is visible
 */
export function isVisible(element) {
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
export function safeSendMessage(message, timeout = 5000) {
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
export function safeQueryTabs(queryInfo) {
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
export function safeTabSendMessage(tabId, message) {
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