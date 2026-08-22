/**
 * PhishNet Heuristic & Threat Detection Engine
 * Advanced on-device phishing, homograph, lookalike domain, and attachment detection
 */

(function () {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  const UTILITY_SELECTORS = root.PhishNet?.UTILITY_SELECTORS || {
    suspiciousTlds: [
      '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club',
      '.work', '.date', '.faith', '.loan', '.win', '.bid', '.review',
      '.country', '.stream', '.download', '.xin', '.racing', '.men',
      '.buzz', '.surf', '.icu', '.monster', '.rest'
    ],
    urlShorteners: [
      'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd',
      'buff.ly', 'adf.ly', 'bc.vc', 'shorte.st', 'clck.ru', 'cutt.ly', 'rb.gy'
    ]
  };

  const HIGH_PROFILE_BRANDS = [
    'paypal', 'microsoft', 'google', 'amazon', 'apple', 'netflix',
    'chase', 'wellsfargo', 'bankofamerica', 'citibank', 'coinbase',
    'binance', 'dhl', 'fedex', 'usps', 'ups', 'facebook', 'instagram',
    'twitter', 'linkedin', 'github', 'dropbox', 'adobe', 'walmart', 'ebay'
  ];

  // Converted to Set for O(1) extension lookup speed
  const DANGEROUS_EXTENSIONS = new Set([
    'exe', 'scr', 'bat', 'cmd', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh',
    'hta', 'iso', 'img', 'lnk', 'jar', 'msi', 'ps1', 'reg', 'pif', 'com'
  ]);

  // Pre-compiled regular expressions to eliminate per-call regex instantiation & GC overhead
  const CYRILLIC_LOOKALIKES_REGEX = /[\u0430\u0435\u043E\u0440\u0441\u0443\u0445\u0456\u0458\u0400-\u04FF]/;
  const LATIN_REGEX = /[a-zA-Z]/;
  const IP_HOSTNAME_REGEX = /^\d+\.\d+\.\d+\.\d+$/;
  const MULTI_DIGIT_REGEX = /[0-9]{4,}/;

  // Common multi-part public suffixes for registrable-domain extraction
  const MULTI_PART_SUFFIXES = [
    'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'co.jp', 'ne.jp', 'or.jp',
    'com.au', 'net.au', 'org.au', 'com.br', 'com.mx', 'com.ar',
    'co.in', 'net.in', 'org.in', 'com.cn', 'com.hk', 'co.nz',
    'com.sg', 'com.tr', 'co.za', 'com.my', 'co.kr'
  ];

  // Registrable domains that belong to major brands under non-obvious names
  const KNOWN_OFFICIAL_DOMAINS = new Set([
    'microsoftonline.com', 'live.com', 'office.com', 'outlook.com',
    'msn.com', 'windowsupdate.com', 'googlemail.com', 'youtube.com',
    'gmail.com', 'youtu.be'
  ]);

  function getRegistrableDomain(domain) {
    const parts = String(domain || '').toLowerCase().split('.');
    for (const suffix of MULTI_PART_SUFFIXES) {
      if (parts.length > 2 && domain.endsWith('.' + suffix)) {
        return parts.slice(-3).join('.');
      }
    }
    return parts.slice(-2).join('.');
  }

  /**
   * True if hostname belongs to a well-known brand (any TLD / subdomain depth)
   */
  function isOfficialBrandHost(hostname) {
    if (!hostname) return false;
    const host = String(hostname).toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split(':')[0];
    const registrable = getRegistrableDomain(host);
    if (KNOWN_OFFICIAL_DOMAINS.has(registrable)) return true;

    const regParts = registrable.split('.');
    // Single-suffix registrable: brand is the second-level label (amazon.de -> 'amazon')
    const secondLevel = regParts.length >= 2 ? regParts[regParts.length - 2] : registrable;
    if (HIGH_PROFILE_BRANDS.includes(secondLevel)) return true;
    // Multi-part suffix registrable: brand is the first label (google.co.uk -> 'google')
    if (regParts.length === 3) {
      const maybeSuffix = regParts.slice(-2).join('.');
      if (MULTI_PART_SUFFIXES.includes(maybeSuffix) && HIGH_PROFILE_BRANDS.includes(regParts[0])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Levenshtein Distance for typo-squatting detection
   * Optimized to use two 1D row buffers instead of full 2D matrix allocation (O(min(N,M)) space)
   */
  function levenshteinDistance(a, b) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    let row0 = new Array(a.length + 1);
    let row1 = new Array(a.length + 1);

    for (let j = 0; j <= a.length; j++) row0[j] = j;

    for (let i = 0; i < b.length; i++) {
      row1[0] = i + 1;
      for (let j = 0; j < a.length; j++) {
        const cost = b.charCodeAt(i) === a.charCodeAt(j) ? 0 : 1;
        row1[j + 1] = Math.min(row1[j] + 1, row0[j + 1] + 1, row0[j] + cost);
      }
      const tmp = row0;
      row0 = row1;
      row1 = tmp;
    }
    return row0[a.length];
  }

  /**
   * Check for Cyrillic/Greek homograph characters in Latin text
   */
  function detectHomographAttack(str) {
    if (!str) return false;
    // Punycode check
    if (str.toLowerCase().includes('xn--')) return true;

    // Check for mixed scripts using pre-compiled regexes
    const hasLatin = LATIN_REGEX.test(str);
    const hasCyrillic = CYRILLIC_LOOKALIKES_REGEX.test(str);

    return hasLatin && hasCyrillic;
  }

  /**
   * Lookalike brand analysis
   */
  function checkLookalikeBrand(domain) {
    if (!domain) return null;
    const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split(':')[0];

    // Homograph check first (catches pаypal.com even though it "matches" the brand)
    if (detectHomographAttack(cleanDomain)) {
      return { brand: 'unknown', type: 'homograph', reason: `Homograph / deceptive characters in domain (${cleanDomain})` };
    }

    // Official domain exemption: brand as registrable second-level label, any TLD
    // (google.co.uk, amazon.de, mail.google.com) or known official alternate domains
    if (isOfficialBrandHost(cleanDomain)) {
      return null;
    }

    const parts = cleanDomain.split('.');
    const mainName = parts.length > 1 ? parts[parts.length - 2] : cleanDomain;

    for (const brand of HIGH_PROFILE_BRANDS) {
      // Subdomain deception (e.g., paypal.com.attacker.xyz)
      if (cleanDomain.includes(brand) && !cleanDomain.endsWith(`.${brand}.com`)) {
        return { brand, type: 'subdomain_deception', reason: `Brand '${brand}' deceptive use in subdomain or domain` };
      }

      // Typosquatting (Levenshtein distance 1 or 2)
      if (mainName.length >= 4 && Math.abs(mainName.length - brand.length) <= 2) {
        const dist = levenshteinDistance(mainName, brand);
        if (dist === 1 || (dist === 2 && mainName.length >= 6)) {
          return { brand, type: 'typosquatting', reason: `Typosquatted lookalike domain for '${brand}' (${mainName})` };
        }
      }
    }

    return null;
  }

  /**
   * Attachment threat analysis
   */
  function analyzeAttachment(filename = '') {
    if (!filename) return { dangerous: false };
    const lowerName = filename.toLowerCase().trim();

    // Check double extensions (e.g., Invoice.pdf.exe) using Set.has for O(1) speed
    const doubleExtMatch = lowerName.match(/\.([a-z0-9]+)\.([a-z0-9]+)$/i);
    if (doubleExtMatch) {
      const outerExt = doubleExtMatch[2];
      if (DANGEROUS_EXTENSIONS.has(outerExt)) {
        return {
          filename,
          dangerous: true,
          reason: `Deceptive double extension detected: .${doubleExtMatch[1]}.${outerExt}`
        };
      }
    }

    // Direct dangerous extension using Set.has for O(1) speed
    const extMatch = lowerName.match(/\.([a-z0-9]+)$/i);
    if (extMatch) {
      const ext = extMatch[1];
      if (DANGEROUS_EXTENSIONS.has(ext)) {
        return {
          filename,
          dangerous: true,
          reason: `Executable or script attachment: .${ext}`
        };
      }
    }

    return { filename, dangerous: false };
  }

  /**
   * Check if URL is suspicious (heuristic)
   */
  function isUrlSuspicious(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      const domain = parsed.hostname.toLowerCase();

      // Homograph check
      if (detectHomographAttack(domain)) return true;

      // Lookalike brand check
      const lookalike = checkLookalikeBrand(domain);
      if (lookalike) return true;

      // Official brand hosts are exempt from generic heuristics below
      // (prevents myaccount.google.com / login.microsoftonline.com false positives)
      const brandHost = isOfficialBrandHost(domain);

      // URL shorteners (brand-owned shorteners t.co/goo.gl excluded)
      const shorteners = UTILITY_SELECTORS.urlShorteners || [
        'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd',
        'buff.ly', 'adf.ly', 'bc.vc', 'shorte.st', 'clck.ru', 'cutt.ly', 'rb.gy'
      ];
      for (const s of shorteners) {
        if ((s === 't.co' || s === 'goo.gl') && brandHost) continue;
        if (domain === s || domain.endsWith('.' + s)) return true;
      }

      if (brandHost) return false;

      // Suspicious TLDs
      const suspiciousTlds = UTILITY_SELECTORS.suspiciousTlds || [
        '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club',
        '.work', '.date', '.faith', '.loan', '.win', '.bid', '.review'
      ];
      for (const tld of suspiciousTlds) {
        if (domain.endsWith(tld)) return true;
      }

      // IP address hostname using pre-compiled regex
      if (IP_HOSTNAME_REGEX.test(domain)) return true;

      // Excessive subdomains
      if (domain.split('.').length > 4) return true;

      // Suspicious keywords in path/subdomain
      const keywords = ['secure', 'verify', 'account', 'login', 'signin', 'update', 'confirm', 'banking', 'credential'];
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

    if (detectHomographAttack(lowerDomain)) return true;
    if (checkLookalikeBrand(lowerDomain)) return true;

    // Suspicious TLDs
    const suspiciousTlds = UTILITY_SELECTORS.suspiciousTlds || ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club'];
    for (const tld of suspiciousTlds) {
      if (lowerDomain.endsWith(tld)) return true;
    }

    if (IP_HOSTNAME_REGEX.test(lowerDomain)) return true;
    if (MULTI_DIGIT_REGEX.test(lowerDomain)) return true;

    return false;
  }

  /**
   * Advanced Heuristic Phishing Detection
   */
  function heuristicDetect(emailContent = {}, links = [], attachments = []) {
    const text = emailContent?.text || '';
    const subject = emailContent?.subject || '';
    const sender = emailContent?.sender || {};
    const emailLinks = emailContent?.links || [];
    const emailAttachments = emailContent?.attachments || [];
    const allLinks = [...emailLinks, ...links];
    const allAttachments = [...emailAttachments, ...attachments];

    let urgencyScore = 0;
    let senderTrustScore = 0;
    let linkRiskScore = 0;
    let attachmentRiskScore = 0;
    const reasons = [];

    // 1. Urgency & Panic Analysis
    const urgencyKeywords = [
      'urgent', 'immediate', 'verify', 'account', 'suspend', 'locked',
      'click here', 'confirm', 'update', 'security', 'unauthorized',
      'limited time', 'act now', 'expire', 'password', 'credential',
      'bank', 'paypal', 'amazon', 'microsoft', 'apple', 'google',
      'invoice', 'receipt', 'order', 'shipment', 'delivery',
      'refund', 'tax', 'irs', 'government', 'legal', 'court'
    ];

    const fullText = `${subject} ${text}`.toLowerCase();
    const foundUrgency = urgencyKeywords.filter(kw => fullText.includes(kw));

    if (foundUrgency.length > 0) {
      urgencyScore = Math.min(foundUrgency.length * 10, 40);
      reasons.push(`Urgency signals: ${foundUrgency.slice(0, 3).join(', ')}`);
    }

    // 2. Sender Domain & Lookalike Analysis
    if (sender.domain) {
      const lookalike = checkLookalikeBrand(sender.domain);
      if (lookalike) {
        senderTrustScore += 45;
        reasons.push(lookalike.reason);
      } else if (isDomainSuspicious(sender.domain)) {
        senderTrustScore += 30;
        reasons.push(`Suspicious sender domain: ${sender.domain}`);
      }
    }

    if (sender.email) {
      const emailLower = sender.email.toLowerCase();
      const securityPrefixes = ['security@', 'support@', 'admin@', 'noreply@', 'no-reply@', 'billing@', 'service@'];
      const hasSecPrefix = securityPrefixes.some(p => emailLower.includes(p));
      if (hasSecPrefix && sender.domain && isDomainSuspicious(sender.domain)) {
        senderTrustScore += 25;
        reasons.push(`Security persona from unverified domain: ${sender.email}`);
      }
    }

    // 3. Link Inspection
    let suspiciousLinkCount = 0;
    const analyzedLinks = allLinks.map(link => {
      if (!link || !link.href) return null;
      let isSusp = isUrlSuspicious(link.href);
      const lookalike = checkLookalikeBrand(new URL(link.href, 'https://example.com').hostname);
      let linkReason = '';

      if (lookalike) {
        isSusp = true;
        linkReason = lookalike.reason;
      }

      // Check text mismatch
      if (link.text && link.text.match(/^https?:\/\//)) {
        try {
          const textHost = new URL(link.text).hostname.toLowerCase();
          const hrefHost = new URL(link.href).hostname.toLowerCase();
          if (textHost !== hrefHost) {
            isSusp = true;
            linkReason = `Destination (${hrefHost}) hides behind display text (${textHost})`;
          }
        } catch (e) {}
      }

      if (isSusp) {
        suspiciousLinkCount++;
        return { ...link, suspicious: true, reason: linkReason || 'Suspicious URL pattern' };
      }
      return { ...link, suspicious: false };
    }).filter(Boolean);

    if (suspiciousLinkCount > 0) {
      linkRiskScore = Math.min(suspiciousLinkCount * 20, 45);
      reasons.push(`${suspiciousLinkCount} suspicious link(s) detected`);
    }

    // 4. Attachment Inspection
    let dangerousAttachmentCount = 0;
    const analyzedAttachments = allAttachments.map(att => {
      const filename = typeof att === 'string' ? att : att?.name || '';
      const analysis = analyzeAttachment(filename);
      if (analysis.dangerous) {
        dangerousAttachmentCount++;
        reasons.push(`Dangerous attachment: ${analysis.reason}`);
        return { name: filename, dangerous: true, reason: analysis.reason };
      }
      return { name: filename, dangerous: false };
    });

    if (dangerousAttachmentCount > 0) {
      attachmentRiskScore = Math.min(dangerousAttachmentCount * 35, 50);
    }

    // 5. HTML Form / Capitalization / Greetings
    if (text.includes('<form') || text.includes('<input')) {
      reasons.push('Interactive form elements inside email');
    }

    const rawLetters = text.replace(/[^a-zA-Z]/g, '');
    const capsCount = (rawLetters.match(/[A-Z]/g) || []).length;
    const capsRatio = rawLetters.length > 20 ? capsCount / rawLetters.length : 0;
    if (capsRatio > 0.35) {
      reasons.push('Excessive capitalization detected');
    }

    const genericGreetings = ['dear customer', 'dear user', 'hello customer', 'valued customer', 'dear sir/madam'];
    if (genericGreetings.some(g => fullText.includes(g))) {
      reasons.push('Generic unpersonalized greeting');
    }

    // Aggregate Score
    const totalScore = Math.min(urgencyScore + senderTrustScore + linkRiskScore + attachmentRiskScore, 100);
    const confidence = Math.min(Math.max(totalScore / 100, 0.05), 0.98);

    let label = 'legitimate_email';
    if (confidence >= 0.65 || dangerousAttachmentCount > 0) {
      label = 'phishing_email';
    } else if (confidence >= 0.35) {
      label = 'uncertain';
    }

    return {
      label,
      confidence,
      reasons: reasons.slice(0, 6),
      processingTime: 0,
      links: analyzedLinks,
      attachments: analyzedAttachments,
      signals: {
        urgencyScore,
        senderTrustScore,
        linkRiskScore,
        attachmentRiskScore,
        totalRiskScore: totalScore
      },
      allScores: {
        legitimate_email: Number((1 - confidence).toFixed(2)),
        phishing_email: Number(confidence.toFixed(2)),
        legitimate_url: Number((1 - confidence).toFixed(2)),
        phishing_url: Number(confidence.toFixed(2))
      }
    };
  }

  // Attach to global PhishNet namespace
  root.PhishNet = root.PhishNet || {};
  Object.assign(root.PhishNet, {
    heuristicDetect,
    isUrlSuspicious,
    isDomainSuspicious,
    checkLookalikeBrand,
    analyzeAttachment,
    detectHomographAttack,
    levenshteinDistance
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      heuristicDetect,
      isUrlSuspicious,
      isDomainSuspicious,
      checkLookalikeBrand,
      analyzeAttachment,
      detectHomographAttack,
      levenshteinDistance
    };
  }
})();