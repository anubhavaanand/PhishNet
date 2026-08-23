/**
 * PhishNet Heuristic & Threat Detection Engine v1.1
 *
 * Research-grounded techniques:
 *  - UTS #39-style confusable skeletoning (homoglyph normalization)
 *  - Damerau-Levenshtein distance (transposition-aware typosquatting)
 *  - Display-name vs sender-domain brand impersonation cross-check
 *  - Open-redirect, dangerous-scheme, invisible-character URL inspection
 *  - Category-weighted scoring squashed through a logistic function
 */

(function () {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  const UTILITY_SELECTORS = root.PhishNet?.UTILITY_SELECTORS || {
    suspiciousTlds: ['.tk','.ml','.ga','.cf','.gq','.xyz','.top','.club','.work','.date','.faith','.loan','.win','.bid','.review','.country','.stream','.download','.xin','.racing','.men','.buzz','.surf','.icu','.monster','.rest'],
    urlShorteners: ['bit.ly','tinyurl.com','goo.gl','t.co','ow.ly','is.gd','buff.ly','adf.ly','bc.vc','shorte.st','clck.ru','cutt.ly','rb.gy']
  };

  const HIGH_PROFILE_BRANDS = [
    'paypal','microsoft','google','amazon','apple','netflix','chase',
    'wellsfargo','bankofamerica','citibank','coinbase','binance','dhl',
    'fedex','usps','ups','facebook','instagram','twitter','linkedin',
    'github','dropbox','adobe','walmart','ebay'
  ];
  const BRAND_SET = new Set(HIGH_PROFILE_BRANDS);

  const DANGEROUS_EXTENSIONS = new Set([
    'exe','scr','bat','cmd','vbs','vbe','js','jse','wsf','wsh',
    'hta','iso','img','lnk','jar','msi','ps1','reg','pif'
  ]);

  const CYRILLIC_REGEX = /\p{Script=Cyrillic}/u;
  const GREEK_REGEX   = /\p{Script=Greek}/u;
  const LATIN_REGEX   = /[a-zA-Z]/;
  const IP_HOSTNAME_REGEX = /^\d{1,3}(\.\d{1,3}){3}$/;

  // zero-width joiner/non-joiner, word-joiner, BOM, soft hyphen
  const INVISIBLE_CHARS = new Set([0x200B,0x200C,0x200D,0x2060,0xFEFF,0xAD].map(c => String.fromCharCode(c)));
  const hasInvisible = s => { for (const ch of s) if (INVISIBLE_CHARS.has(ch)) return true; return false; };
  const stripInvisible = s => { let o=''; for (const ch of s) if (!INVISIBLE_CHARS.has(ch)) o+=ch; return o; };

  const MULTI_PART_SUFFIXES = new Set([
    'co.uk','org.uk','ac.uk','gov.uk','co.jp','ne.jp','or.jp',
    'com.au','net.au','org.au','com.br','com.mx','com.ar',
    'co.in','net.in','org.in','com.cn','com.hk','co.nz',
    'com.sg','com.tr','co.za','com.my','co.kr'
  ]);

  const KNOWN_OFFICIAL_DOMAINS = new Set([
    'microsoftonline.com','live.com','office.com','outlook.com','msn.com',
    'windowsupdate.com','googlemail.com','youtube.com','gmail.com','youtu.be'
  ]);

  // memoization caches (bounded) — hot paths hit these per brand per link
  const REG_DOMAIN_CACHE = new Map();
  const SKELETON_CACHE = new Map();

  const SUSPICIOUS_TLD_SET = new Set(
    (UTILITY_SELECTORS.suspiciousTlds || []).map(t => t.replace(/^\./, ''))
  );
  const SHORTENER_SET = new Set(UTILITY_SELECTORS.urlShorteners || []);

  function getRegistrableDomain(host) {
    if (!host) return '';
    const cached = REG_DOMAIN_CACHE.get(host);
    if (cached !== undefined) return cached;
    const parts = String(host).toLowerCase().replace(/\.$/, '').split('.');
    for (const suffix of MULTI_PART_SUFFIXES) {
      const sl = suffix.split('.').length;
      if (parts.length > sl && parts.slice(-sl).join('.') === suffix) {
        return parts.slice(-(sl + 1)).join('.');
      }
    }
    const out = parts.slice(-2).join('.');
    if (REG_DOMAIN_CACHE.size < 2048) REG_DOMAIN_CACHE.set(host, out);
    return out;
  }

  function isOfficialBrandHost(hostname) {
    if (!hostname) return false;
    const host = String(hostname).toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split(':')[0];
    const registrable = getRegistrableDomain(host);
    if (KNOWN_OFFICIAL_DOMAINS.has(registrable)) return true;

    const regParts = registrable.split('.');
    const secondLevel = regParts.length >= 2 ? regParts[regParts.length - 2] : registrable;
    if (BRAND_SET.has(secondLevel)) return true;

    if (regParts.length === 3) {
      const maybeSuffix = regParts.slice(-2).join('.');
      if (MULTI_PART_SUFFIXES.has(maybeSuffix) && BRAND_SET.has(regParts[0])) return true;
    }
    return false;
  }

  /* ===================================================================
   * UTS #39-style confusable skeletoning.
   * Maps visually ambiguous code points to their Latin base and folds
   * common digit/letter substitutions, so homoglyph attacks collapse
   * into their ASCII target BEFORE string distances are computed.
   * ================================================================== */
  const CONFUSABLE_MAP = new Map();
  (function buildConfusables() {
    // Cyrillic/Greek homoglyphs -> Latin base (per-letter groups only;
    // never map one plain Latin letter onto another)
    const groups = {
      a: ['\u0430', '\u03B1'],
      c: ['\u0441', '\u03F2'],
      e: ['\u0435', '\u03B5'],
      h: ['\u04BB'],
      i: ['\u0456', '\u03AF'],
      j: ['\u0458'],
      o: ['\u043E', '\u03BF'],
      p: ['\u0440'],
      s: ['\u0455', '\u03C2'],
      x: ['\u0445'],
      y: ['\u0443']
    };
    for (const [latin, lookalikes] of Object.entries(groups)) {
      CONFUSABLE_MAP.set(latin, latin);
      for (const lk of lookalikes) CONFUSABLE_MAP.set(lk.toLowerCase(), latin);
    }
    // Common digit/symbol substitutions, used only during brand comparison.
    // Applied after letter groups so they cannot shadow them.
    const digitFolds = { '0':'o', '1':'l', '3':'e', '4':'a', '5':'s', '7':'t', '8':'b', '$':'s', '@':'a' };
    for (const [from, to] of Object.entries(digitFolds)) CONFUSABLE_MAP.set(from, to);
  })();

  /**
   * skeleton(str): fold str into its unambiguous ASCII form.
   * 'p\u0430ypal' -> 'paypal', 'g00gle' -> 'google'
   */
  function skeleton(str) {
    const raw = String(str || '');
    const hit = SKELETON_CACHE.get(raw);
    if (hit !== undefined) return hit;
    let s0 = raw.toLowerCase().normalize('NFKC');
    s0 = stripInvisible(s0);
    let out = '';
    for (const ch of s0) out += CONFUSABLE_MAP.get(ch) || ch;
    if (SKELETON_CACHE.size < 1024) SKELETON_CACHE.set(raw, out);
    return out;
  }

  /**
   * Damerau-Levenshtein (OSA form) with three-row buffers:
   * counts adjacent transpositions ('payapl' <-> 'paypal' = 1)
   * without per-call map allocations.
   */
  function damerauLevenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;

    let prevPrev = new Array(n + 1);
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);

    for (let j = 0; j <= n; j++) { prev[j] = j; prevPrev[j] = j; }

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        let v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          v = Math.min(v, prevPrev[j - 2] + 1); // the swap itself is the single edit
        }
        curr[j] = v;
      }
      // rotate THREE generations: curr recycles the oldest buffer
      // (recycling old-prev here aliases prevPrev two rows back)
      const oldest = prevPrev;
      prevPrev = prev;
      prev = curr;
      curr = oldest;
    }
    return prev[n];
  }

  // legacy alias retained for API compatibility
  function levenshteinDistance(a, b) { return damerauLevenshtein(a, b); }

  /**
   * Mixed-script homograph detection (Latin + Cyrillic/Greek mixing,
   * punycode labels, or invisible characters).
   */
  function detectHomographAttack(str) {
    if (!str) return false;
    const s = String(str).toLowerCase();
    if (s.includes('xn--')) return true;
    if (hasInvisible(s)) return true;
    const hasLatin = LATIN_REGEX.test(s);
    return (hasLatin && CYRILLIC_REGEX.test(s)) || (hasLatin && GREEK_REGEX.test(s) && s.length > 4);
  }

  /**
   * Lookalike brand analysis with skeleton-normalized comparison.
   */
  // memoized wrapper — same domain strings recur across sender + every link
  const LOOKALIKE_CACHE = new Map();
  function checkLookalikeBrand(domain) {
    if (!domain) return null;
    if (LOOKALIKE_CACHE.has(domain)) return LOOKALIKE_CACHE.get(domain);
    const result = checkLookalikeBrandUncached(domain);
    if (LOOKALIKE_CACHE.size < 2048) LOOKALIKE_CACHE.set(domain, result);
    return result;
  }

  function checkLookalikeBrandUncached(domain) {
    const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split(':')[0];

    if (detectHomographAttack(cleanDomain)) {
      return { brand: 'unknown', type: 'homograph', reason: `Homograph / deceptive characters in domain (${cleanDomain})` };
    }

    if (isOfficialBrandHost(cleanDomain)) return null;

    const parts = cleanDomain.split('.');
    const mainName = parts.length > 1 ? parts[parts.length - 2] : cleanDomain;
    const skelMain = skeleton(mainName);
    const skelDomain = skeleton(cleanDomain);

    for (const brand of BRAND_SET) {
      // subdomain deception: brand appears anywhere but this isn't an official host
      // (official hosts were already exempted above)
      if (cleanDomain.includes(brand) && mainName !== brand) {
        return { brand, type: 'subdomain_deception', reason: `Brand '${brand}' deceptive use in subdomain or domain` };
      }
      // typosquatting on skeleton forms with Damerau distance.
      // dist 0 with a different raw label = perfect skeleton spoof (paypa1.com)
      if (mainName.length >= 4 && Math.abs(mainName.length - brand.length) <= 2) {
        const dist = damerauLevenshtein(skelMain, brand);
        if (dist === 0 && mainName !== brand) {
          return { brand, type: 'skeleton_spoof', reason: `Confusable characters spoofing '${brand}' (${mainName})` };
        }
        if (dist === 1 || (dist === 2 && mainName.length >= 6)) {
          return { brand, type: 'typosquatting', reason: `Typosquatted lookalike domain for '${brand}' (${mainName})` };
        }
      }
      // whole-domain skeleton match (catches digit folds like g00gle.com)
      if (skelDomain === brand || skelDomain.endsWith(brand + 'com')) {
        if (skelDomain !== cleanDomain || /\d/.test(mainName)) {
          return { brand, type: 'skeleton_spoof', reason: `Confusable characters spoofing '${brand}' (${cleanDomain})` };
        }
      }
    }
    return null;
  }

  function analyzeAttachment(filename = '') {
    if (!filename) return { dangerous: false };
    const lowerName = filename.toLowerCase().trim();
    const doubleExtMatch = lowerName.match(/\.([a-z0-9]+)\.([a-z0-9]+)$/i);
    if (doubleExtMatch && DANGEROUS_EXTENSIONS.has(doubleExtMatch[2])) {
      return { filename, dangerous: true, reason: `Deceptive double extension detected: .${doubleExtMatch[1]}.${doubleExtMatch[2]}` };
    }
    const extMatch = lowerName.match(/\.([a-z0-9]+)$/i);
    if (extMatch && DANGEROUS_EXTENSIONS.has(extMatch[1])) {
      return { filename, dangerous: true, reason: `Executable or script attachment: .${extMatch[1]}` };
    }
    return { filename, dangerous: false };
  }

  const OPEN_REDIRECT_REGEX = /[?&](url|redirect|redir|next|continue|dest|destination|return)=/i;
  const DANGEROUS_SCHEME_REGEX = /^\s*(data|javascript|vbscript|file):/i;

  function isUrlSuspicious(url) {
    if (!url) return false;
    const raw = String(url);

    // dangerous schemes
    if (DANGEROUS_SCHEME_REGEX.test(raw)) return true;
    // invisible-character obfuscation
    if (hasInvisible(raw)) return true;

    let parsed;
    try { parsed = new URL(raw); } catch { return true; }
    const domain = parsed.hostname.toLowerCase();

    if (detectHomographAttack(domain)) return true;
    const lookalike = checkLookalikeBrand(domain);
    if (lookalike) return true;

    const brandHost = isOfficialBrandHost(domain);

    // shorteners (brand-owned t.co / goo.gl exempt on official hosts)
    for (const s of SHORTENER_SET) {
      if ((s === 't.co' || s === 'goo.gl') && brandHost) continue;
      if (domain === s || domain.endsWith('.' + s)) return true;
    }

    if (brandHost) {
      // official hosts still fail on open-redirect params
      if (OPEN_REDIRECT_REGEX.test(raw) && /https?%3a%2f%2f|https?:\/\/[^.]/i.test(raw)) return true;
      return false;
    }

    for (const tld of SUSPICIOUS_TLD_SET) {
      if (domain.endsWith(tld.startsWith('.') ? tld : '.' + tld)) return true;
    }

    if (IP_HOSTNAME_REGEX.test(domain)) return true;
    if (domain.split('.').length > 4) return true;
    if (domain.length > 75) return true;
    // hyphen abuse: 3+ hyphen-separated labels in the registrable SLD
    const reg = getRegistrableDomain(domain);
    const sld = reg.split('.')[0];
    if ((sld.match(/-/g) || []).length >= 3) return true;

    // open-redirect parameters pointing off-host
    if (OPEN_REDIRECT_REGEX.test(raw) && /(https?%3a%2f%2f|https?:\/\/)/i.test(raw)) return true;

    const keywords = ['secure','verify','account','login','signin','update','confirm','banking','credential'];
    for (const kw of keywords) {
      if (domain.includes(kw) && !domain.startsWith(kw + '.') && !domain.endsWith('.' + kw + '.com')) return true;
    }
    return false;
  }

  function isDomainSuspicious(domain) {
    if (!domain) return false;
    const lowerDomain = domain.toLowerCase();
    if (detectHomographAttack(lowerDomain)) return true;
    if (checkLookalikeBrand(lowerDomain)) return true;
    for (const tld of SUSPICIOUS_TLD_SET) {
      if (lowerDomain.endsWith(tld.startsWith('.') ? tld : '.' + tld)) return true;
    }
    if (IP_HOSTNAME_REGEX.test(lowerDomain)) return true;
    if (/[0-9]{4,}/.test(lowerDomain)) return true;
    return false;
  }

  /**
   * Display-name vs sender-domain impersonation:
   * "PayPal Service <random@mail.example>" is a classic combo-spoof.
   */
  function detectDisplayNameImpersonation(sender) {
    if (!sender || !sender.name || !sender.domain) return null;
    const name = String(sender.name).toLowerCase();
    const tokens = name.split(/[^a-z0-9]+/).filter(t => t.length >= 4);
    for (const token of tokens) {
      const skel = skeleton(token);
      for (const brand of BRAND_SET) {
        if (skel === brand && !isOfficialBrandHost(sender.domain)) {
          return { brand, reason: `Display name claims '${brand}' but mail originates from ${sender.domain}` };
        }
      }
    }
    // also catch raw brand substring in display name
    for (const brand of BRAND_SET) {
      if (name.includes(brand) && !isOfficialBrandHost(sender.domain)) {
        return { brand, reason: `Display name references '${brand}' but sent from unverified domain ${sender.domain}` };
      }
    }
    return null;
  }

  /* ===================================================================
   * Weighted scoring + logistic calibration.
   * Sub-score caps preserved for the Threat Inspector UI:
   *   urgency 0-40, trust 0-45, links 0-45, attachments 0-50
   * ================================================================== */
  const LOGISTIC_MIDPOINT = 42;
  const LOGISTIC_SCALE = 12;
  function squash(score) {
    const c = 1 / (1 + Math.exp(-((score - LOGISTIC_MIDPOINT) / LOGISTIC_SCALE)));
    return Math.min(Math.max(c, 0.04), 0.97);
  }

  function heuristicDetect(emailContent = {}, links = [], attachments = []) {
    const text = emailContent?.text || '';
    const subject = emailContent?.subject || '';
    const sender = emailContent?.sender || {};
    const emailLinks = emailContent?.links || [];
    const emailAttachments = emailContent?.attachments || [];
    const allLinks = [...emailLinks, ...links];
    const allAttachments = [...emailAttachments, ...attachments];

    let urgencyScore = 0, senderTrustScore = 0, linkRiskScore = 0, attachmentRiskScore = 0;
    const reasons = [];

    // ---- 1. urgency & pressure language ----
    const urgencyKeywords = [
      'urgent','immediate','verify','account','suspend','locked','click here',
      'confirm','update','security','unauthorized','limited time','act now',
      'expire','password','credential','bank','paypal','amazon','microsoft',
      'apple','google','invoice','receipt','order','shipment','delivery',
      'refund','tax','irs','government','legal','court'
    ];
    const fullText = `${subject} ${text}`.toLowerCase();
    const foundUrgency = [...new Set(urgencyKeywords.filter(kw => fullText.includes(kw)))];
    if (foundUrgency.length > 0) {
      urgencyScore = Math.min(foundUrgency.length * 8, 40);
      reasons.push(`Urgency signals: ${foundUrgency.slice(0, 3).join(', ')}`);
    }

    // ---- 2. sender identity analysis ----
    if (sender.domain) {
      const lookalike = checkLookalikeBrand(sender.domain);
      if (lookalike) {
        senderTrustScore += 45;
        reasons.push(lookalike.reason);
      } else if (isDomainSuspicious(sender.domain)) {
        senderTrustScore += 30;
        reasons.push(`Suspicious sender domain: ${sender.domain}`);
      }

      const impersonation = detectDisplayNameImpersonation(sender);
      if (impersonation) {
        senderTrustScore += 34;
        reasons.push(impersonation.reason);
      }

      if (sender.email) {
        const emailLower = String(sender.email).toLowerCase();
        const prefixes = ['security@','support@','admin@','noreply@','no-reply@','billing@','service@'];
        if (prefixes.some(p => emailLower.startsWith(p)) && isDomainSuspicious(sender.domain)) {
          senderTrustScore += 25;
          reasons.push(`Security persona from unverified domain: ${sender.email}`);
        }
      }
    }

    // ---- 3. link inspection ----
    let suspiciousLinkCount = 0;
    const analyzedLinks = allLinks.map(link => {
      if (!link || !link.href) return null;
      let isSusp = isUrlSuspicious(link.href);
      let linkReason = '';

      let host = '';
      try { host = new URL(link.href, 'https://example.invalid').hostname.toLowerCase(); } catch {}
      const lookalike = checkLookalikeBrand(host);
      if (lookalike) { isSusp = true; linkReason = lookalike.reason; }

      if (link.text && /^https?:\/\//i.test(link.text.trim())) {
        try {
          const textHost = new URL(link.text.trim()).hostname.toLowerCase();
          const hrefHost = new URL(link.href).hostname.toLowerCase();
          if (textHost !== hrefHost) {
            isSusp = true;
            linkReason = `Destination (${hrefHost}) hides behind display text (${textHost})`;
          }
        } catch {}
      }

      if (isSusp) {
        suspiciousLinkCount++;
        return { ...link, suspicious: true, reason: linkReason || 'Suspicious URL pattern' };
      }
      return { ...link, suspicious: false };
    }).filter(Boolean);

    if (suspiciousLinkCount > 0) {
      linkRiskScore = Math.min(suspiciousLinkCount * 16, 45);
      reasons.push(`${suspiciousLinkCount} suspicious link(s) detected`);
    }

    // ---- 4. attachment inspection ----
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

    // ---- 5. content-level signals ----
    if (text.includes('<form') || text.includes('<input')) {
      reasons.push('Interactive form elements inside email');
    }
    if (hasInvisible(text)) {
      reasons.push('Invisible / zero-width obfuscation characters in body');
    }

    const rawLetters = text.replace(/[^a-zA-Z]/g, '');
    const capsCount = (rawLetters.match(/[A-Z]/g) || []).length;
    if (rawLetters.length > 20 && capsCount / rawLetters.length > 0.35) {
      reasons.push('Excessive capitalization detected');
    }

    const genericGreetings = ['dear customer','dear user','hello customer','valued customer','dear sir/madam'];
    if (genericGreetings.some(g => fullText.includes(g))) {
      reasons.push('Generic unpersonalized greeting');
    }

    // ---- aggregate with logistic calibration ----
    let totalRisk = urgencyScore + senderTrustScore + linkRiskScore + attachmentRiskScore;
    if (dangerousAttachmentCount > 0) totalRisk = Math.max(totalRisk, 70); // floor for weaponized attachments
    totalRisk = Math.min(totalRisk, 100);

    const confidence = squash(totalRisk);

    let label = 'legitimate_email';
    if (confidence >= 0.65 || dangerousAttachmentCount > 0) label = 'phishing_email';
    else if (confidence >= 0.35) label = 'uncertain';

    return {
      label,
      confidence,
      engine: 'heuristic-v1.1',
      reasons: [...new Set(reasons)].slice(0, 6),
      processingTime: 0,
      links: analyzedLinks,
      attachments: analyzedAttachments,
      signals: {
        urgencyScore,
        senderTrustScore,
        linkRiskScore,
        attachmentRiskScore,
        totalRiskScore: totalRisk
      },
      allScores: {
        legitimate_email: Number((1 - confidence).toFixed(3)),
        phishing_email: Number(confidence.toFixed(3)),
        legitimate_url: Number((1 - confidence).toFixed(3)),
        phishing_url: Number(confidence.toFixed(3))
      }
    };
  }

  /* ---- exports ---- */
  root.PhishNet = root.PhishNet || {};
  Object.assign(root.PhishNet, {
    heuristicDetect,
    isUrlSuspicious,
    isDomainSuspicious,
    checkLookalikeBrand,
    analyzeAttachment,
    detectHomographAttack,
    detectDisplayNameImpersonation,
    skeleton,
    damerauLevenshtein,
    levenshteinDistance,
    getRegistrableDomain,
    isOfficialBrandHost
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      heuristicDetect,
      isUrlSuspicious,
      isDomainSuspicious,
      checkLookalikeBrand,
      analyzeAttachment,
      detectHomographAttack,
      detectDisplayNameImpersonation,
      skeleton,
      damerauLevenshtein,
      levenshteinDistance,
      getRegistrableDomain,
      isOfficialBrandHost
    };
  }
})();
