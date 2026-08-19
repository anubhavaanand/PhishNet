/**
 * PhishNet Heuristic Detector
 * Fallback phishing detection when ML model is unavailable
 * Provides basic protection using rule-based analysis
 */

(function () {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  const UTILITY_SELECTORS = root.PhishNet?.UTILITY_SELECTORS || {
    suspiciousTlds: [
      '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club',
      '.work', '.date', '.faith', '.loan', '.win', '.bid', '.review',
      '.country', '.stream', '.download', '.xin', '.racing', '.men'
    ],
    urlShorteners: [
      'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd',
      'buff.ly', 'adf.ly', 'bc.vc', 'shorte.st', 'clck.ru', 'cutt.ly'
    ]
  };

  /**
   * Check if URL is suspicious (heuristic)
   */
  function isUrlSuspicious(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      const domain = parsed.hostname.toLowerCase();

      // Suspicious TLDs
      const suspiciousTlds = UTILITY_SELECTORS.suspiciousTlds || [
        '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club',
        '.work', '.date', '.faith', '.loan', '.win', '.bid', '.review'
      ];
      for (const tld of suspiciousTlds) {
        if (domain.endsWith(tld)) return true;
      }

      // URL shorteners
      const shorteners = UTILITY_SELECTORS.urlShorteners || [
        'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd',
        'buff.ly', 'adf.ly', 'bc.vc', 'shorte.st', 'clck.ru', 'cutt.ly'
      ];
      for (const s of shorteners) {
        if (domain === s || domain.endsWith('.' + s)) return true;
      }

      // IP address hostname
      if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return true;

      // Excessive subdomains
      if (domain.split('.').length > 4) return true;

      // Suspicious keywords in subdomain / path
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
    if (!domain) return false;
    const lowerDomain = domain.toLowerCase();

    // Suspicious TLDs
    const suspiciousTlds = UTILITY_SELECTORS.suspiciousTlds || ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club'];
    for (const tld of suspiciousTlds) {
      if (lowerDomain.endsWith(tld)) return true;
    }

    // IP address as domain
    if (/^\d+\.\d+\.\d+\.\d+$/.test(lowerDomain)) return true;

    // Many numbers in domain
    if (/[0-9]{4,}/.test(lowerDomain)) return true;

    // Brand impersonation in domain / subdomain
    const brands = ['paypal', 'amazon', 'microsoft', 'apple', 'google', 'bank', 'chase', 'wells', 'fargo', 'citi', 'netflix'];
    for (const brand of brands) {
      if (lowerDomain.includes(brand)) {
        // Safe only if exact official domain
        const isOfficial = lowerDomain === `${brand}.com` || lowerDomain.endsWith(`.${brand}.com`);
        if (!isOfficial) return true;
      }
    }

    return false;
  }

  /**
   * Heuristic-based phishing detection
   * Returns a result object compatible with ML model output
   */
  function heuristicDetect(emailContent, links = []) {
    const text = emailContent?.text || '';
    const subject = emailContent?.subject || '';
    const sender = emailContent?.sender || {};
    const emailLinks = emailContent?.links || [];
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

    // 2. Check sender email and domain
    if (sender.email) {
      const emailLower = sender.email.toLowerCase();
      const suspiciousPrefixes = ['security@', 'support@', 'admin@', 'noreply@', 'no-reply@', 'billing@', 'service@'];
      const hasSecurityPrefix = suspiciousPrefixes.some(p => emailLower.includes(p));
      if (hasSecurityPrefix && sender.domain && isDomainSuspicious(sender.domain)) {
        phishingScore += 35;
        reasons.push(`Security-themed sender from unverified domain: ${sender.email}`);
      }
    }

    if (sender.domain) {
      if (isDomainSuspicious(sender.domain)) {
        phishingScore += 25;
        reasons.push(`Suspicious sender domain: ${sender.domain}`);
      }
    }

    // 3. Check links
    let suspiciousLinks = 0;
    for (const link of allLinks) {
      if (link && link.href && isUrlSuspicious(link.href)) {
        suspiciousLinks++;
        link.suspicious = true;
      }
    }
    if (suspiciousLinks > 0) {
      phishingScore += Math.min(suspiciousLinks * 15, 30);
      reasons.push(`${suspiciousLinks} suspicious link(s) detected`);
    }

    // 4. Check for mismatched link text
    for (const link of allLinks) {
      if (link && link.text && link.href && link.text.match(/^https?:\/\//) && link.text !== link.href) {
        try {
          const textDomain = new URL(link.text).hostname.toLowerCase();
          const hrefDomain = new URL(link.href).hostname.toLowerCase();
          if (textDomain !== hrefDomain) {
            phishingScore += 20;
            link.suspicious = true;
            reasons.push(`Link text (${textDomain}) mismatches destination (${hrefDomain})`);
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
      reasons.push('Contains interactive form/input elements');
    }

    // 6. Check for excessive capitalization (shouting)
    const rawLetters = text.replace(/[^a-zA-Z]/g, '');
    const capsCount = (rawLetters.match(/[A-Z]/g) || []).length;
    const capsRatio = rawLetters.length > 20 ? capsCount / rawLetters.length : 0;
    if (capsRatio > 0.35) {
      phishingScore += 10;
      reasons.push('Excessive capitalization detected');
    }

    // 7. Check for generic greetings
    const genericGreetings = ['dear customer', 'dear user', 'hello customer', 'valued customer', 'dear sir/madam', 'dear account holder'];
    for (const greeting of genericGreetings) {
      if (fullText.includes(greeting)) {
        phishingScore += 10;
        reasons.push('Uses generic greeting (not personalized)');
        break;
      }
    }

    // Normalize score to 0-1 range
    const confidence = Math.min(Math.max(phishingScore / 100, 0.05), 0.98);

    // Determine label based on confidence
    let label = 'legitimate_email';
    if (confidence >= 0.65) {
      label = 'phishing_email';
    } else if (confidence >= 0.35) {
      label = 'uncertain';
    }

    return {
      label,
      confidence,
      reasons: reasons.slice(0, 5),
      processingTime: 0,
      links: allLinks,
      allScores: {
        legitimate_email: Number((1 - confidence).toFixed(2)),
        phishing_email: Number(confidence.toFixed(2)),
        legitimate_url: Number((1 - confidence).toFixed(2)),
        phishing_url: Number(confidence.toFixed(2))
      }
    };
  }

  /**
   * Quick heuristic check for phishing indicators
   * Returns true if likely phishing
   */
  function quickPhishingCheck(text, senderDomain = '') {
    const phishingIndicators = [
      'urgent', 'immediate', 'verify your account', 'click here',
      'suspended', 'locked', 'confirm your identity', 'update your information',
      'limited time', 'act now', 'expire', 'password', 'credential'
    ];

    const lowerText = (text || '').toLowerCase();
    let score = 0;

    for (const indicator of phishingIndicators) {
      if (lowerText.includes(indicator)) score++;
    }

    // Check sender
    if (senderDomain && isDomainSuspicious(senderDomain)) score += 2;

    return score >= 3;
  }

  // Attach to global PhishNet namespace
  root.PhishNet = root.PhishNet || {};
  Object.assign(root.PhishNet, {
    heuristicDetect,
    quickPhishingCheck,
    isUrlSuspicious,
    isDomainSuspicious
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      heuristicDetect,
      quickPhishingCheck,
      isUrlSuspicious,
      isDomainSuspicious
    };
  }
})();