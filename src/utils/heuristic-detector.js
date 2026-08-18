/**
 * PhishNet Heuristic Detector
 * Fallback phishing detection when ML model is unavailable
 * Provides basic protection using rule-based analysis
 */

import { UTILITY_SELECTORS } from '../selectors.js';

/**
 * Heuristic-based phishing detection
 * Returns a result object compatible with ML model output
 */
export function heuristicDetect(emailContent, links = []) {
  const { text, subject, sender, links: emailLinks } = emailContent;
  const allLinks = [...emailLinks, ...links];

  let phishingScore = 0;
  const reasons = [];

  // 1. Check for urgency keywords in subject + body
  const urgencyKeywords = [
    'urgent', 'immediate', 'verify', 'account', 'suspend', 'locked',
    'click here', 'confirm', 'update', 'security', 'unauthorized',
    'limited time', 'act now', 'expire', 'password', 'credential',
    'bank', 'paypal', 'amazon', 'microsoft', 'apple', 'google',
    'invoice', 'receipt', 'order', 'shipment', 'delivery',
    'refund', 'tax', 'irs', 'government', 'legal', 'court'
  ];

  const fullText = `${subject} ${text}`.toLowerCase();
  const foundUrgency = urgencyKeywords.filter(kw => fullText.includes(kw.toLowerCase()));

  if (foundUrgency.length > 0) {
    phishingScore += Math.min(foundUrgency.length * 10, 40);
    reasons.push(`Contains urgency keywords: ${foundUrgency.slice(0, 3).join(', ')}`);
  }

  // 2. Check sender domain
  if (sender.domain) {
    if (isDomainSuspicious(sender.domain)) {
      phishingScore += 25;
      reasons.push(`Suspicious sender domain: ${sender.domain}`);
    }
    // Check for brand impersonation in subdomain
    const brands = ['paypal', 'amazon', 'microsoft', 'apple', 'google', 'bank', 'chase', 'wells', 'fargo', 'citi'];
    for (const brand of brands) {
      if (sender.domain.includes(brand) && !sender.domain.startsWith(brand + '.') && !sender.domain.endsWith('.' + brand + '.com')) {
        phishingScore += 20;
        reasons.push(`Possible ${brand} impersonation in sender domain`);
        break;
      }
    }
  }

  // 3. Check links
  let suspiciousLinks = 0;
  for (const link of allLinks) {
    if (isUrlSuspicious(link.href)) {
      suspiciousLinks++;
    }
  }
  if (suspiciousLinks > 0) {
    phishingScore += Math.min(suspiciousLinks * 15, 30);
    reasons.push(`${suspiciousLinks} suspicious link(s) detected`);
  }

  // 4. Check for mismatched link text
  for (const link of allLinks) {
    if (link.text && link.text.match(/^https?:\/\//) && link.text !== link.href) {
      try {
        const textDomain = new URL(link.text).hostname;
        const hrefDomain = new URL(link.href).hostname;
        if (textDomain !== hrefDomain) {
          phishingScore += 20;
          reasons.push('Link text mismatches actual URL');
          break;
        }
      } catch (e) {
        // Invalid URL in text
      }
    }
  }

  // 5. Check for HTML/forms in email (phishing often uses forms)
  if (text.includes('<form') || text.includes('<input')) {
    phishingScore += 15;
    reasons.push('Contains HTML form elements');
  }

  // 6. Check for excessive capitalization (shouting)
  const capsRatio = (text.match(/[A-Z]/g) || []).length / Math.max(text.length, 1);
  if (capsRatio > 0.3) {
    phishingScore += 10;
    reasons.push('Excessive capitalization detected');
  }

  // 7. Check for generic greetings
  const genericGreetings = ['dear customer', 'dear user', 'hello customer', 'valued customer', 'dear sir/madam'];
  for (const greeting of genericGreetings) {
    if (fullText.includes(greeting)) {
      phishingScore += 10;
      reasons.push('Uses generic greeting (not personalized)');
      break;
    }
  }

  // Normalize score to 0-1 range
  const confidence = Math.min(phishingScore / 100, 0.95);

  // Determine label based on confidence
  let label = 'legitimate_email';
  if (confidence > 0.7) {
    label = 'phishing_email';
  } else if (confidence > 0.4) {
    label = 'uncertain';
  }

  return {
    label,
    confidence,
    reasons: reasons.slice(0, 5),
    processingTime: 0,
    allScores: {
      legitimate_email: 1 - confidence,
      phishing_email: confidence,
      legitimate_url: 1 - confidence,
      phishing_url: confidence
    }
  };
}

/**
 * Check if URL is suspicious (heuristic)
 */
function isUrlSuspicious(url) {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.toLowerCase();

    // Suspicious TLDs
    const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club', '.work', '.date', '.faith', '.loan', '.win', '.bid', '.review'];
    for (const tld of suspiciousTlds) {
      if (domain.endsWith(tld)) return true;
    }

    // URL shorteners
    const shorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd', 'buff.ly', 'adf.ly', 'bc.vc', 'shorte.st', 'clck.ru', 'cutt.ly'];
    for (const s of shorteners) {
      if (domain.includes(s)) return true;
    }

    // IP address
    if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return true;

    // Excessive subdomains
    if (domain.split('.').length > 4) return true;

    // Suspicious keywords in domain
    const keywords = ['secure', 'verify', 'account', 'login', 'signin', 'update', 'confirm', 'bank', 'paypal', 'amazon', 'microsoft', 'apple'];
    for (const kw of keywords) {
      if (domain.includes(kw) && !domain.startsWith(kw + '.') && !domain.endsWith('.' + kw + '.com')) return true;
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
 * Quick heuristic check for phishing indicators
 * Returns true if likely phishing
 */
export function quickPhishingCheck(text, senderDomain = '') {
  const phishingIndicators = [
    'urgent', 'immediate', 'verify your account', 'click here',
    'suspended', 'locked', 'confirm your identity', 'update your information',
    'limited time', 'act now', 'expire', 'password', 'credential'
  ];

  const lowerText = text.toLowerCase();
  let score = 0;

  for (const indicator of phishingIndicators) {
    if (lowerText.includes(indicator)) score++;
  }

  // Check sender
  if (senderDomain && isDomainSuspicious(senderDomain)) score += 2;

  return score >= 3; // Threshold for "likely phishing"
}