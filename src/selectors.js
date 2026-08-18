/**
 * CSS Selectors for Gmail and Outlook email extraction
 * Adapted from inbox-triage-extension with PhishNet-specific additions
 */

const EMAIL_SELECTORS = {
  gmail: {
    // Main thread container
    threadContainer: '[data-thread-id]',

    // Individual email messages within thread
    messages: '[data-message-id]',

    // Email content areas
    messageBody: '[data-message-id] .ii.gt div',
    messageBodyAlt: '[data-message-id] .a3s.aiL',
    messageBodyFallback: '[data-message-id] .gs',

    // Subject line
    subject: 'h2[data-thread-id] span',
    subjectAlt: '[data-legacy-thread-id] h2 span',
    subjectFallback: 'h2.hP',

    // Sender information
    sender: '[data-message-id] .go span[email]',
    senderName: '[data-message-id] .go .qu span[title]',
    senderFallback: '[data-message-id] .gD[email]',

    // Date/time
    timestamp: '[data-message-id] .g3 span[title]',

    // Thread view indicator
    threadView: '[data-thread-id]',

    // Compose/reply area (to avoid extracting)
    composeArea: '.M9[data-message-id]',
    draftArea: '[data-is-draft="true"]',

    // Attachment selectors
    attachments: '[data-message-id] .aZo, [data-message-id] span[download_url]',
    attachmentLinks: '[data-message-id] .aZo a, [data-message-id] span[download_url] a',
    attachmentNames: '[data-message-id] .aV3, [data-message-id] .aZo span[title]',
    attachmentSizes: '[data-message-id] .SaRA, [data-message-id] .aZo .SaRBLe',

    // Link selectors for phishing detection
    links: '[data-message-id] a[href]',
    linkText: '[data-message-id] a[href] *'
  },

  outlook: {
    // Main thread container
    threadContainer: '[data-convid]',

    // Individual messages
    messages: '[data-convid] [role="listitem"]',

    // Message content
    messageBody: '[data-testid="message-body-content"]',
    messageBodyAlt: '.rps_1679 .elementToProof',
    messageBodyFallback: '[data-testid="message-body"] .allowTextSelection',

    // Subject
    subject: '[data-testid="conversation-subject"]',
    subjectAlt: 'h1[id*="subject"]',
    subjectFallback: '[data-testid="subject"]',

    // Sender information
    sender: '[data-testid="message-header-sender-name"]',
    senderEmail: '[data-testid="message-header-sender-email"]',
    senderFallback: '[data-testid="from"]',

    // Timestamp
    timestamp: '[data-testid="message-header-date"]',

    // Thread container
    threadView: '[data-testid="conversation-container"]',

    // Areas to avoid
    composeArea: '[data-testid="compose-body-wrapper"]',
    replyArea: '[data-testid="reply-compose-box"]',

    // Attachment selectors
    attachments: '[data-testid*="attachment"]',
    attachmentLinks: '[data-testid*="attachment"] a',
    attachmentNames: '[data-testid="attachment-name"]',
    attachmentSizes: '[data-testid="attachment-size"]',

    // Link selectors for phishing detection
    links: '[data-convid] a[href]',
    linkText: '[data-convid] a[href] *'
  },

  // Outlook.com specific selectors (personal Outlook)
  outlookCom: {
    threadContainer: '[data-convid]',
    messages: '[data-convid] [role="listitem"]',
    messageBody: '[data-testid="message-body-content"]',
    messageBodyAlt: '[data-testid="message-body"] .allowTextSelection',
    messageBodyFallback: '.allowTextSelection',
    subject: '[data-testid="conversation-subject"]',
    subjectAlt: 'h1[data-testid="subject"]',
    sender: '[data-testid="message-header-sender-name"]',
    senderEmail: '[data-testid="message-header-sender-email"]',
    timestamp: '[data-testid="message-header-date"]',
    threadView: '[data-testid="conversation-container"]',
    composeArea: '[data-testid="compose-body-wrapper"]',
    replyArea: '[data-testid="reply-compose-box"]',
    attachments: '[data-testid*="attachment"]',
    attachmentLinks: '[data-testid*="attachment"] a',
    attachmentNames: '[data-testid="attachment-name"]',
    attachmentSizes: '[data-testid="attachment-size"]',
    links: '[data-convid] a[href]',
    linkText: '[data-convid] a[href] *'
  },

  // Outlook Office 365 specific selectors (business/enterprise Outlook)
  outlookOffice365: {
    threadContainer: '[data-convid]',
    messages: '[data-convid] [role="listitem"]',
    messageBody: '[data-testid="message-body-content"]',
    messageBodyAlt: '[aria-label*="Message body"] .allowTextSelection',
    messageBodyFallback: '.allowTextSelection',
    subject: '[data-testid="conversation-subject"]',
    subjectAlt: '[id*="subject"]',
    sender: '[data-testid="message-header-sender-name"]',
    senderEmail: '[data-testid="message-header-sender-email"]',
    timestamp: '[data-testid="message-header-date"]',
    threadView: '[data-testid="conversation-container"]',
    composeArea: '[data-testid="compose-body-wrapper"]',
    replyArea: '[data-testid="reply-compose-box"]',
    attachments: '[data-testid*="attachment"]',
    attachmentLinks: '[data-testid*="attachment"] a',
    attachmentNames: '[data-testid="attachment-name"]',
    attachmentSizes: '[data-testid="attachment-size"]',
    links: '[data-convid] a[href]',
    linkText: '[data-convid] a[href] *'
  }
};

/**
 * Get the appropriate selectors for the current email provider
 * Enhanced to detect Outlook version variations
 */
function getSelectorsForCurrentSite() {
  const hostname = window.location.hostname;
  const url = window.location.href;

  if (hostname.includes('mail.google.com')) {
    return { provider: 'gmail', variant: 'standard', selectors: EMAIL_SELECTORS.gmail };
  } else if (hostname.includes('outlook.')) {
    // Detect Outlook version variations
    if (hostname.includes('outlook.office.com') ||
        hostname.includes('outlook.office365.com') ||
        url.includes('/owa/') ||
        url.includes('/mail/')) {
      // Office 365 Outlook (business/enterprise)
      return { provider: 'outlook', variant: 'office365', selectors: EMAIL_SELECTORS.outlookOffice365 };
    } else if (hostname.includes('outlook.live.com') ||
               hostname.includes('outlook.com')) {
      // Outlook.com (personal)
      return { provider: 'outlook', variant: 'com', selectors: EMAIL_SELECTORS.outlookCom };
    } else {
      // Default Outlook (fallback)
      return { provider: 'outlook', variant: 'default', selectors: EMAIL_SELECTORS.outlook };
    }
  }

  return null;
}

/**
 * Additional utility selectors
 */
const UTILITY_SELECTORS = {
  // Common patterns for avoiding extraction of certain elements
  skipElements: [
    '[data-is-draft="true"]',
    '.compose',
    '.reply-box',
    '[data-testid*="compose"]',
    '.gmail_signature',
    '.signature',
    '[data-smartmail="signature"]',
    '.yj6qo', // Gmail signature class
    '.adn.ads' // Gmail ads
  ],

  // Loading indicators
  loadingIndicators: [
    '.loading',
    '[data-testid="loading"]',
    '.spinner',
    '.ms-Spinner'
  ],

  // Phishing indicator keywords (for reason generation)
  phishingKeywords: [
    'urgent', 'immediate', 'verify', 'account', 'suspend', 'locked',
    'click here', 'confirm', 'update', 'security', 'unauthorized',
    'limited time', 'act now', 'expire', 'password', 'credential',
    'bank', 'paypal', 'amazon', 'microsoft', 'apple', 'google',
    'invoice', 'receipt', 'order', 'shipment', 'delivery',
    'refund', 'tax', 'irs', 'government', 'legal', 'court'
  ],

  // Suspicious TLDs
  suspiciousTlds: [
    '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club',
    '.work', '.date', '.faith', '.loan', '.win', '.bid', '.review',
    '.country', '.stream', '.download', '.xin', '.racing', '.men'
  ],

  // URL shorteners
  urlShorteners: [
    'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd',
    'buff.ly', 'adf.ly', 'bc.vc', 'shorte.st', 'clck.ru', 'cutt.ly'
  ]
};

// Expose globally for use in content script
window.getSelectorsForCurrentSite = getSelectorsForCurrentSite;
window.EMAIL_SELECTORS = EMAIL_SELECTORS;
window.UTILITY_SELECTORS = UTILITY_SELECTORS;