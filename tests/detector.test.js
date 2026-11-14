/**
 * Detection engine tests: heuristics, URLs, attachments, brand lookalikes.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('../src/utils/heuristic-detector.js');

describe('string distance helpers', () => {
  test('levenshteinDistance counts single edits', () => {
    assert.equal(levenshteinDistance('paypal', 'paypa1'), 1);
    assert.equal(levenshteinDistance('amazon', 'arnazon'), 2);
    assert.equal(levenshteinDistance('apple', 'apple'), 0);
  });

  test('damerauLevenshtein counts a transposition as one edit', () => {
    assert.equal(damerauLevenshtein('payapl', 'paypal'), 1);
    assert.equal(damerauLevenshtein('paypal', 'paypal'), 0);
    assert.equal(damerauLevenshtein('abc', 'cab'), 2);
  });

  test('damerauLevenshtein agrees with levenshteinDistance when no transposition applies', () => {
    assert.equal(damerauLevenshtein('amazon', 'amazn'), levenshteinDistance('amazon', 'amazn'));
  });

  test('skeleton folds homoglyphs and digit substitutions', () => {
    assert.equal(skeleton('pаypal'), 'paypal'); // Cyrillic 'а'
    assert.equal(skeleton('g00gle'), 'google');
    assert.equal(skeleton('rnicros0ft'.replace('rn', 'm')), 'microsoft');
  });

  test('skeleton is case insensitive', () => {
    assert.equal(skeleton('PayPal'), skeleton('paypal'));
  });
});

describe('homograph detection', () => {
  test('flags mixed-script domains', () => {
    assert.equal(detectHomographAttack('pаypal.com'), true); // Cyrillic 'а'
    assert.equal(detectHomographAttack('microsоft.com'), true); // Cyrillic 'о'
  });

  test('does not flag plain ASCII domains', () => {
    assert.equal(detectHomographAttack('paypal.com'), false);
    assert.equal(detectHomographAttack('github.com'), false);
  });

  test('handles punctuation-free and empty input without throwing', () => {
    assert.equal(typeof detectHomographAttack(''), 'boolean');
    assert.equal(typeof detectHomographAttack('localhost'), 'boolean');
  });
});

describe('brand lookalike detection', () => {
  test('flags digit-substituted brands', () => {
    assert.ok(checkLookalikeBrand('paypa1.com'), 'paypa1.com must be flagged');
    assert.ok(checkLookalikeBrand('g00gle.com'), 'g00gle.com must be flagged');
  });

  test('flags transposed typosquats', () => {
    assert.ok(checkLookalikeBrand('payapl.com'), 'payapl.com must be flagged');
  });

  test('flags subdomain deception', () => {
    assert.ok(checkLookalikeBrand('paypal.com.account-verify.xyz'));
  });

  test('does not flag the official domain', () => {
    assert.equal(checkLookalikeBrand('paypal.com'), null);
  });

  test('does not flag regional official domains', () => {
    for (const d of ['google.co.uk', 'amazon.de', 'microsoft.fr', 'apple.co.in', 'mail.google.com']) {
      assert.equal(checkLookalikeBrand(d), null, `${d} must not be flagged`);
      assert.equal(isUrlSuspicious(`https://${d}/`), false, `${d} URL must not be suspicious`);
    }
  });

  test('does not flag Microsoft identity hosts', () => {
    for (const d of ['login.microsoftonline.com', 'outlook.office365.com']) {
      assert.equal(checkLookalikeBrand(d), null, `${d} must not be flagged`);
    }
  });

  test('does not flag Google account hosts', () => {
    for (const d of ['myaccount.google.com', 'accounts.google.com']) {
      assert.equal(isUrlSuspicious(`https://${d}/signin`), false, `${d} must not be flagged`);
    }
  });
});

describe('isDomainSuspicious', () => {
  test('flags bare IP hosts', () => {
    assert.equal(isDomainSuspicious('192.168.1.1'), true);
  });

  test('accepts ordinary domains', () => {
    assert.equal(isDomainSuspicious('github.com'), false);
  });

  test('tolerates null-ish input', () => {
    assert.equal(typeof isDomainSuspicious(''), 'boolean');
  });
});

describe('URL analysis', () => {
  test('flags nonstandard web ports even for otherwise trusted hosts', () => {
    for (const url of [
      'https://www.paypal.com:8443/account',
      'http://github.com:8080/login',
      'https://github.com:9443/settings',
    ]) {
      assert.equal(isUrlSuspicious(url), true, `${url} must be suspicious`);
    }
  });

  test('accepts default HTTP/HTTPS ports and ordinary mailto links', () => {
    for (const url of [
      'https://www.paypal.com:443/account',
      'http://github.com:80/settings',
      'https://github.com/settings',
      'mailto:security@example.com',
    ]) {
      assert.equal(isUrlSuspicious(url), false, `${url} must not be suspicious`);
    }
  });

  test('flags high-abuse TLDs', () => {
    assert.equal(isUrlSuspicious('http://paypal-login.tk/verify'), true);
    assert.equal(isUrlSuspicious('https://microsoft-support.xyz/update'), true);
  });

  test('flags URL shorteners', () => {
    assert.equal(isUrlSuspicious('https://bit.ly/3xYz123'), true);
    assert.equal(isUrlSuspicious('https://tinyurl.com/emergency-auth'), true);
  });

  test('flags IP-address hostnames', () => {
    assert.equal(isUrlSuspicious('http://192.168.1.1/login.php'), true);
  });

  test('flags dangerous URI schemes', () => {
    assert.equal(isUrlSuspicious('data:text/html;base64,PHNjcmlwdD4='), true);
    assert.equal(isUrlSuspicious('javascript:void(0)'), true);
    assert.equal(isUrlSuspicious('vbscript:msgbox(1)'), true);
  });

  test('flags links with non-web, non-mail URI schemes', () => {
    for (const url of ['ftp://github.com/file', 'file:///etc/passwd', 'ws://github.com/socket', 'wss://github.com/socket']) {
      assert.equal(isUrlSuspicious(url), true, `expected ${url} to be suspicious`);
    }
    assert.equal(isUrlSuspicious('https://github.com/settings/security'), false);
    assert.equal(isUrlSuspicious('mailto:security@example.com'), false);
  });

  test('flags open-redirect parameters', () => {
    assert.equal(
      isUrlSuspicious('https://newsletter-provider.example.net/?redirect=https://evil.example.tk/login'),
      true
    );
  });

  test('flags invisible-character obfuscation', () => {
    assert.equal(isUrlSuspicious('https://example.co\u200Bm/secure'), true);
  });

  test('accepts ordinary https URLs', () => {
    assert.equal(isUrlSuspicious('https://github.com/settings/security'), false);
    assert.equal(isUrlSuspicious('https://www.amazon.com/order-history'), false);
  });
});

describe('attachment analysis', () => {
  test('detects executable filenames obscured by Windows ADS and trailing punctuation', () => {
    for (const filename of ['file.exe::$DATA', 'file.exe:stream:$DATA', 'file.exe.', 'file.exe .  ']) {
      assert.equal(analyzeAttachment(filename).dangerous, true, filename);
    }
    assert.equal(analyzeAttachment('file.pdf::$DATA').dangerous, false);
  });

  test('ignores bidirectional and zero-width controls when checking an extension', () => {
    assert.equal(analyzeAttachment('file.exe\u202e.').dangerous, true);
    assert.equal(analyzeAttachment('file.e\u200bxe').dangerous, true);
    assert.equal(analyzeAttachment('file.pdf').dangerous, false);
  });

  test('flags deceptive double extensions', () => {
    const a = analyzeAttachment('Invoice_August2026.pdf.exe');
    assert.equal(a.dangerous, true);
    assert.match(a.reason, /double extension/i);

    assert.equal(analyzeAttachment('Document.docx.vbs').dangerous, true);
  });

  test('flags directly executable extensions', () => {
    assert.equal(analyzeAttachment('payment_receipt.iso').dangerous, true);
    assert.equal(analyzeAttachment('runme.scr').dangerous, true);
    assert.equal(analyzeAttachment('form.hta').dangerous, true);
  });

  test('flags executable extensions regardless of case', () => {
    assert.equal(analyzeAttachment('INVOICE.PDF.EXE').dangerous, true);
  });

  test('allows safe documents and images', () => {
    assert.equal(analyzeAttachment('Monthly_Report.pdf').dangerous, false);
    assert.equal(analyzeAttachment('screenshot.png').dangerous, false);
    assert.equal(analyzeAttachment('notes.docx').dangerous, false);
  });

  test('handles empty and extension-less names without throwing', () => {
    assert.equal(typeof analyzeAttachment('').dangerous, 'boolean');
    assert.equal(typeof analyzeAttachment('README').dangerous, 'boolean');
  });
});

describe('display-name impersonation', () => {
  test('flags a brand name on an unrelated domain', () => {
    const hit = detectDisplayNameImpersonation({ name: 'PayPal Service Team', domain: 'random-mailer-news.xyz' });
    assert.ok(hit, 'brand display name from unrelated domain must be flagged');
  });

  test('accepts a brand name on its official domain', () => {
    const clean = detectDisplayNameImpersonation({ name: 'PayPal Service Team', domain: 'paypal.com' });
    assert.equal(clean, null);
  });

  test('tolerates missing fields', () => {
    assert.equal(detectDisplayNameImpersonation({}), null);
  });
});

describe('heuristicDetect — classification', () => {
  test('flags credential phishing with urgency and a bad link', () => {
    const result = heuristicDetect({
      subject: 'URGENT: Your Account Will Be Closed!',
      text: 'Dear Customer, Unusual activity on your PayPal account. Permanent suspension in 24 hours. Click here to verify: http://paypal-security-update.ml/verify',
      sender: { email: 'security@paypal-verification.tk', domain: 'paypal-verification.tk' },
      links: [{ href: 'http://paypal-security-update.ml/verify', text: 'Verify Now' }],
    });

    assert.equal(result.label, 'phishing_email');
    assert.ok(result.confidence >= 0.65, `confidence ${result.confidence} below 0.65`);
    assert.ok(result.signals.urgencyScore > 0);
    assert.ok(result.signals.senderTrustScore > 0);
    assert.ok(result.reasons.length > 0, 'expected at least one human-readable reason');
  });

  test('flags a dangerous attachment', () => {
    const result = heuristicDetect({
      subject: 'Invoice past due',
      text: 'Please find attached invoice for review.',
      sender: { email: 'billing@random-services.net', domain: 'random-services.net' },
      attachments: [{ name: 'Invoice_Aug.pdf.exe' }],
    });

    assert.equal(result.label, 'phishing_email');
    assert.ok(result.reasons.some((r) => /dangerous attachment/i.test(r)));
  });

  test('classifies a routine notification as legitimate', () => {
    const result = heuristicDetect({
      subject: 'Your GitHub Security Alert',
      text: 'Hi there, We noticed a new sign-in to your GitHub account from Chrome on Linux. If this was you, no action is needed.',
      sender: { email: 'noreply@github.com', domain: 'github.com' },
      links: [{ href: 'https://github.com/settings/security', text: 'Settings' }],
    });

    assert.equal(result.label, 'legitimate_email');
    assert.ok(result.confidence < 0.35, `confidence ${result.confidence} should be low`);
  });

  test('confidence rises monotonically as signals are added', () => {
    const base = { text: 'hello world', subject: 'Hi', sender: { domain: '', email: '' }, links: [], attachments: [] };
    const c0 = heuristicDetect(base).confidence;
    const c1 = heuristicDetect({ ...base, text: 'urgent verify account now' }).confidence;
    const c2 = heuristicDetect({
      ...base,
      text: 'urgent verify account now',
      links: [{ href: 'http://paypa1-support.tk/x' }],
    }).confidence;

    assert.ok(c1 > c0, `expected ${c1} > ${c0}`);
    assert.ok(c2 > c1, `expected ${c2} > ${c1}`);
  });

  test('confidence stays within [0, 1]', () => {
    const loud = heuristicDetect({
      subject: 'URGENT!!! Account suspended',
      text: 'verify your password immediately, confirm your identity, act now, limited time, click here',
      sender: { email: 'security@paypa1-verify.tk', domain: 'paypa1-verify.tk' },
      links: [
        { href: 'http://paypa1-verify.tk/login' },
        { href: 'https://bit.ly/x' },
        { href: 'http://192.168.1.1/a' },
      ],
      attachments: [{ name: 'a.pdf.exe' }, { name: 'b.scr' }],
    }).confidence;

    assert.ok(loud >= 0 && loud <= 1, `confidence ${loud} out of range`);
  });
});

describe('heuristicDetect — robustness', () => {
  test('does not throw on an empty email', () => {
    const result = heuristicDetect({});
    assert.equal(typeof result.label, 'string');
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
    assert.ok(Array.isArray(result.reasons));
  });

  test('does not throw when every field is explicitly null', () => {
    const result = heuristicDetect({ subject: null, text: null, sender: null, links: null, attachments: null });
    assert.equal(typeof result.label, 'string');
  });

  test('does not throw on very long input', () => {
    const result = heuristicDetect({ subject: 'x', text: 'a'.repeat(200000), sender: null });
    assert.equal(typeof result.label, 'string');
  });

  test('handles malformed link entries', () => {
    const result = heuristicDetect({
      subject: 'Hi',
      text: 'see link',
      sender: { domain: 'github.com', email: 'a@github.com' },
      links: [{}, null, { href: '' }, { href: 'not a url' }],
    });
    assert.equal(typeof result.label, 'string');
  });

  test('always returns a links array and an attachments array', () => {
    const result = heuristicDetect({
      subject: 'Hi',
      text: 'body',
      sender: { domain: 'github.com', email: 'a@github.com' },
      links: [{ href: 'http://bit.ly/x' }],
      attachments: [{ name: 'a.pdf.exe' }],
    });
    assert.ok(Array.isArray(result.links));
    assert.ok(Array.isArray(result.attachments));
    assert.equal(result.links[0].suspicious, true);
    assert.equal(result.attachments[0].dangerous, true);
  });
});
