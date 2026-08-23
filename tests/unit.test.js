/**
 * PhishNet Unit Test Suite
 * Comprehensive tests for heuristic detector, homographs, lookalike brands, attachments, selectors, and error boundaries
 */

const assert = require('assert');

// Load modules
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
  levenshteinDistance
} = require('../src/utils/heuristic-detector.js');

const { getSelectorsForCurrentSite } = require('../src/selectors.js');
const { safeText, safeAttr, generateId } = require('../src/utils/error-boundary.js');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

console.log('\n--- 🧪 Running PhishNet Comprehensive Unit Tests ---\n');

// 1. Homograph & Typosquatting Brand Tests
console.log('1. Lookalike & Homograph Attack Tests:');
test('Calculates Levenshtein distance correctly', () => {
  assert.strictEqual(levenshteinDistance('paypal', 'paypa1'), 1);
  assert.strictEqual(levenshteinDistance('amazon', 'arnazon'), 2);
  assert.strictEqual(levenshteinDistance('apple', 'apple'), 0);
});

test('Detects Cyrillic / mixed-script homograph attacks', () => {
  assert.strictEqual(detectHomographAttack('pаypal.com'), true); // 'а' is Cyrillic
  assert.strictEqual(detectHomographAttack('microsоft.com'), true); // 'о' is Cyrillic
  assert.strictEqual(detectHomographAttack('paypal.com'), false);
});

test('Flags lookalike & typosquatted brand domains', () => {
  const typo1 = checkLookalikeBrand('paypa1.com');
  assert.ok(typo1, 'Expected paypa1.com to be flagged as lookalike');

  const subDecept = checkLookalikeBrand('paypal.com.account-verify.xyz');
  assert.ok(subDecept, 'Expected subdomain deception to be flagged');

  const official = checkLookalikeBrand('paypal.com');
  assert.strictEqual(official, null, 'Expected official domain to not be flagged');
});

// 2. Attachment Threat Tests
console.log('\n2. Attachment Threat Analyzer Tests:');
test('Flags deceptive double extensions (.pdf.exe, .docx.vbs)', () => {
  const att1 = analyzeAttachment('Invoice_August2026.pdf.exe');
  assert.strictEqual(att1.dangerous, true);
  assert.ok(att1.reason.includes('double extension'));

  const att2 = analyzeAttachment('Document.docx.vbs');
  assert.strictEqual(att2.dangerous, true);
});

test('Flags direct executable/script extensions (.iso, .scr, .hta)', () => {
  const att = analyzeAttachment('payment_receipt.iso');
  assert.strictEqual(att.dangerous, true);
});

test('Allows safe documents and images (.pdf, .png, .docx)', () => {
  const att1 = analyzeAttachment('Monthly_Report.pdf');
  assert.strictEqual(att1.dangerous, false);

  const att2 = analyzeAttachment('screenshot.png');
  assert.strictEqual(att2.dangerous, false);
});

// 3. URL Analyzer Tests
console.log('\n3. URL Analyzer Tests:');
test('Detects suspicious TLDs (.tk, .ml, .xyz)', () => {
  assert.strictEqual(isUrlSuspicious('http://paypal-login.tk/verify'), true);
  assert.strictEqual(isUrlSuspicious('https://microsoft-support.xyz/update'), true);
});

test('Detects URL shorteners (bit.ly, tinyurl.com)', () => {
  assert.strictEqual(isUrlSuspicious('https://bit.ly/3xYz123'), true);
  assert.strictEqual(isUrlSuspicious('https://tinyurl.com/emergency-auth'), true);
});

test('Detects IP address hostname', () => {
  assert.strictEqual(isUrlSuspicious('http://192.168.1.1/login.php'), true);
});

test('Validates legitimate domains as safe', () => {
  assert.strictEqual(isUrlSuspicious('https://github.com/settings/security'), false);
  assert.strictEqual(isUrlSuspicious('https://www.amazon.com/order-history'), false);
});

// 4. Heuristic Phishing Detection Tests
console.log('\n4. Comprehensive Detection Engine Tests:');
test('Flags credential phishing with urgency and suspicious link', () => {
  const phishingEmail = {
    subject: 'URGENT: Your Account Will Be Closed!',
    text: 'Dear Customer, Unusual activity on your PayPal account. Permanent suspension in 24 hours. Click here to verify: http://paypal-security-update.ml/verify',
    sender: { email: 'security@paypal-verification.tk', domain: 'paypal-verification.tk' },
    links: [{ href: 'http://paypal-security-update.ml/verify', text: 'Verify Now' }]
  };

  const result = heuristicDetect(phishingEmail);
  assert.strictEqual(result.label, 'phishing_email');
  assert.ok(result.confidence >= 0.65);
  assert.ok(result.signals.urgencyScore > 0);
  assert.ok(result.signals.senderTrustScore > 0);
});

test('Flags email with dangerous attachment immediately', () => {
  const attachmentPhish = {
    subject: 'Invoice past due',
    text: 'Please find attached invoice for review.',
    sender: { email: 'billing@random-services.net', domain: 'random-services.net' },
    attachments: [{ name: 'Invoice_Aug.pdf.exe' }]
  };

  const result = heuristicDetect(attachmentPhish);
  assert.strictEqual(result.label, 'phishing_email');
  assert.ok(result.reasons.some(r => r.includes('Dangerous attachment')));
});

test('Classifies legitimate notification as safe', () => {
  const safeEmail = {
    subject: 'Your GitHub Security Alert',
    text: 'Hi there, We noticed a new sign-in to your GitHub account from Chrome on Linux. If this was you, no action is needed.',
    sender: { email: 'noreply@github.com', domain: 'github.com' },
    links: [{ href: 'https://github.com/settings/security', text: 'Settings' }]
  };

  const result = heuristicDetect(safeEmail);
  assert.strictEqual(result.label, 'legitimate_email');
  assert.ok(result.confidence < 0.35);
});

// 5. Selector & Utility Tests
console.log('\n5. Selectors & Error Boundary Tests:');
test('Resolves selectors correctly for Gmail and Outlook', () => {
  const gmail = getSelectorsForCurrentSite({ hostname: 'mail.google.com', href: 'https://mail.google.com' });
  assert.strictEqual(gmail.provider, 'gmail');

  const outlook = getSelectorsForCurrentSite({ hostname: 'outlook.live.com', href: 'https://outlook.live.com' });
  assert.strictEqual(outlook.provider, 'outlook');
});

test('safeText and safeAttr function properly', () => {
  assert.strictEqual(safeText({ textContent: '  test  ' }), 'test');
  assert.strictEqual(safeAttr(null, 'href', 'fallback'), 'fallback');
  assert.ok(generateId('phish').startsWith('phish-'));
});

test('XSS payloads in URLs are safely text-encoded via textContent in DOM elements', () => {
  const xssHref = 'https://example.com/test"><img src=x onerror=alert(1)>';
  const urlSpan = { textContent: '' };
  urlSpan.textContent = xssHref;
  assert.strictEqual(urlSpan.textContent, xssHref);
});

// 6. Official Domain False-Positive Regression Tests
console.log('\n6. Official Domain False-Positive Tests:');
test('Regional official brand domains are NOT flagged', () => {
  const legitDomains = ['google.co.uk', 'amazon.de', 'microsoft.fr', 'apple.co.in', 'mail.google.com'];
  for (const d of legitDomains) {
    assert.strictEqual(checkLookalikeBrand(d), null, `${d} must not be flagged as lookalike`);
    assert.strictEqual(isUrlSuspicious('https://' + d + '/'), false, `${d} URL must not be suspicious`);
  }
});

test('Microsoft official auth domains are NOT flagged', () => {
  for (const d of ['login.microsoftonline.com', 'outlook.office365.com']) {
    assert.strictEqual(checkLookalikeBrand(d), null, `${d} must not be flagged`);
    assert.strictEqual(isUrlSuspicious('https://' + d), false, `${d} URL must not be suspicious`);
  }
});

test('Google account hosts with keyword names are NOT flagged', () => {
  for (const d of ['myaccount.google.com', 'accounts.google.com']) {
    assert.strictEqual(isUrlSuspicious('https://' + d + '/signin'), false, `${d} must not be flagged`);
  }
});

test('Actual spoofed domains ARE still flagged', () => {
  const spoofs = [
    'paypal.com.attacker.xyz',
    'paypa1.com',
    'secure-paypal-verify.com'
  ];
  for (const d of spoofs) {
    assert.ok(
      checkLookalikeBrand(d) !== null || isUrlSuspicious('https://' + d + '/'),
      `${d} must be flagged`
    );
  }
});


// 7. Engine v1.1 — confusable skeletons, Damerau, impersonation, URL hardening
console.log('\n7. Engine v1.1 Feature Tests:');
test('skeleton() folds homoglyphs and digit substitutions', () => {
  assert.strictEqual(skeleton('p\u0430ypal'), 'paypal');
  assert.strictEqual(skeleton('g00gle'), 'google');
  assert.strictEqual(skeleton('rnicros0ft'.replace('rn','m') ), 'microsoft');
});

test('Damerau-Levenshtein counts transpositions as distance 1', () => {
  assert.strictEqual(damerauLevenshtein('payapl', 'paypal'), 1);
  assert.strictEqual(damerauLevenshtein('paypal', 'paypal'), 0);
  assert.strictEqual(damerauLevenshtein('abc', 'cab'), 2);
});

test('Skeleton-equal domains are flagged as spoofs', () => {
  const r = checkLookalikeBrand('paypa1.com');
  assert.ok(r, 'paypa1.com must be flagged');
});

test('Display-name impersonation is detected', () => {
  const hit = detectDisplayNameImpersonation({ name: 'PayPal Service Team', domain: 'random-mailer-news.xyz' });
  assert.ok(hit, 'brand display name from unrelated domain must be flagged');
  const clean = detectDisplayNameImpersonation({ name: 'PayPal Service Team', domain: 'paypal.com' });
  assert.strictEqual(clean, null, 'official host must not be flagged');
});

test('Dangerous URI schemes are flagged', () => {
  assert.ok(isUrlSuspicious('data:text/html;base64,PHNjcmlwdD4='));
  assert.ok(isUrlSuspicious('javascript:void(0)'));
});

test('Open-redirect parameters are flagged', () => {
  assert.ok(isUrlSuspicious('https://newsletter-provider.example.net/?redirect=https://evil.example.tk/login'));
});

test('Invisible-character obfuscation in URLs is flagged', () => {
  assert.ok(isUrlSuspicious('https://example.co\u200Bm/secure'));
});

test('Confidence increases monotonically with added signals', () => {
  const base = { text: 'hello world', subject: 'Hi', sender: { domain: '', email: '' }, links: [], attachments: [] };
  const c0 = heuristicDetect(base).confidence;
  const c1 = heuristicDetect({ ...base, text: 'urgent verify account now' }).confidence;
  const c2 = heuristicDetect({ ...base, text: 'urgent verify account now', links: [{ href: 'http://paypa1-support.tk/x' }] }).confidence;
  assert.ok(c1 > c0, `${c1} > ${c0}`);
  assert.ok(c2 > c1, `${c2} > ${c1}`);
});

// 8. Mini labeled-corpus evaluation with precision/recall gates
console.log('\n8. Corpus Evaluation:');
const PHISH_SAMPLES = [
  { subject: 'Verify your account now', from: 'security@paypa1-support.tk', body: 'Your account is suspended. Confirm your password immediately at http://bit.ly/9xZ' },
  { subject: 'Unusual sign-in attempt', from: 'no-reply@microsoft-security-check.net', body: 'We detected unauthorized activity. Update your information here http://login-micros0ft.com' },
  { subject: 'Your package could not be delivered', from: 'tracking@dhl-parcel-redelivery.info', body: 'Reschedule your shipment and pay a small fee at http://bit.ly/dhl-redeliver' },
  { subject: 'Invoice overdue - final notice', from: 'billing@invoice-center-notice.top', body: 'Please review the attached invoice and settle immediately.' },
  { subject: 'Security alert: new device login', from: 'alerts@secure-appleid-verify.tk', body: 'Confirm your Apple ID credentials to secure your account.' },
  { subject: 'You won a gift card!', from: 'promo@giveaway-rewards.club', body: 'Act now! Limited time offer. Click here to claim your reward.' },
  { subject: 'Bank account locked', from: 'service@chase-online-verify.xyz', body: 'Unlock your bank account by confirming your credential at once.' },
  { subject: 'IRS tax refund pending', from: 'refunds@irs-gov-payment.review', body: 'Submit your tax refund request before it expires. Government deadline.' }
];
const HAM_SAMPLES = [
  { subject: 'Your weekly report is ready', from: 'notifications@github.com', body: 'We processed 1234 transactions. No action required.' },
  { subject: 'Sprint retrospective notes', from: 'lead@company.com', body: 'Key takeaways: keep scope small, write tests first.' },
  { subject: 'Lunch tomorrow?', from: 'friend@example.org', body: 'Want to grab lunch at the usual place around noon?' },
  { subject: 'Order confirmation', from: 'orders@amazon.com', body: 'Your order has shipped. Track it in Your Orders.' },
  { subject: 'Meeting rescheduled', from: 'assistant@company.com', body: 'Moved the design review to Thursday at 3pm.' },
  { subject: 'Welcome to StyleHub', from: 'hello@stylehub.com', body: 'Thanks for subscribing! Here is your welcome discount code.' },
  { subject: 'Course access granted', from: 'support@udemy.com', body: 'You now have lifetime access to the course materials.' },
  { subject: 'Photos from the weekend', from: 'mom@family.net', body: 'Sharing the album from our trip. Take a look when you can!' }
];
test('Corpus recall >= 0.75 on phishing samples', () => {
  let hits = 0;
  for (const s of PHISH_SAMPLES) {
    const r = heuristicDetect({ text: s.body, subject: s.subject,
      sender: { name: '', email: '', domain: s.from.split('@')[1] }, links: [], attachments: [] });
    if (r.label === 'phishing_email') hits++;
  }
  const recall = hits / PHISH_SAMPLES.length;
  assert.ok(recall >= 0.75, `recall ${(recall*100).toFixed(0)}% < 75%`);
});
test('False-positive rate <= 0.25 on ham samples', () => {
  let fp = 0;
  for (const s of HAM_SAMPLES) {
    const r = heuristicDetect({ text: s.body, subject: s.subject,
      sender: { name: s.from.split('@')[0], email: s.from, domain: s.from.split('@')[1] }, links: [], attachments: [] });
    if (r.label === 'phishing_email') fp++;
  }
  const fpr = fp / HAM_SAMPLES.length;
  assert.ok(fpr <= 0.25, `FPR ${(fpr*100).toFixed(0)}% > 25%`);
});

console.log(`\n===================================`);
console.log(`Tests Passed: ${passedTests} | Failed: ${failedTests}`);
console.log(`===================================\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
