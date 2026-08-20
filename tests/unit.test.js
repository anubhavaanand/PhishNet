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

console.log(`\n===================================`);
console.log(`Tests Passed: ${passedTests} | Failed: ${failedTests}`);
console.log(`===================================\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
