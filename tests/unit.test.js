/**
 * PhishNet Unit Test Suite
 * Validates heuristic detector, URL analyzer, selectors, and error boundaries
 */

const assert = require('assert');

// Load modules
const { heuristicDetect, isUrlSuspicious, isDomainSuspicious, quickPhishingCheck } = require('../src/utils/heuristic-detector.js');
const { getSelectorsForCurrentSite, EMAIL_SELECTORS, UTILITY_SELECTORS } = require('../src/selectors.js');
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

console.log('\n--- 🧪 Running PhishNet Unit Tests ---\n');

// 1. URL Analysis Tests
console.log('1. URL Analyzer Tests:');
test('Detects suspicious TLDs (.tk, .ml, .xyz)', () => {
  assert.strictEqual(isUrlSuspicious('http://paypal-login.tk/verify'), true);
  assert.strictEqual(isUrlSuspicious('https://microsoft-support.xyz/update'), true);
  assert.strictEqual(isUrlSuspicious('https://account-alert.ml/signin'), true);
});

test('Detects URL shorteners (bit.ly, tinyurl.com)', () => {
  assert.strictEqual(isUrlSuspicious('https://bit.ly/3xYz123'), true);
  assert.strictEqual(isUrlSuspicious('https://tinyurl.com/emergency-auth'), true);
});

test('Detects IP address hostname', () => {
  assert.strictEqual(isUrlSuspicious('http://192.168.1.1/login.php'), true);
  assert.strictEqual(isUrlSuspicious('http://45.33.32.156/verify'), true);
});

test('Detects brand keyword spoofing in domain', () => {
  assert.strictEqual(isUrlSuspicious('http://paypal-security-update.fakebank.com/login'), true);
  assert.strictEqual(isUrlSuspicious('http://verify-apple-account.suspicious.net/'), true);
});

test('Validates legitimate domains as safe', () => {
  assert.strictEqual(isUrlSuspicious('https://github.com/settings/security'), false);
  assert.strictEqual(isUrlSuspicious('https://www.amazon.com/order-history'), false);
  assert.strictEqual(isUrlSuspicious('https://mail.google.com/mail/u/0/'), false);
});

// 2. Domain Analysis Tests
console.log('\n2. Domain Analyzer Tests:');
test('Identifies spoofed brand domains', () => {
  assert.strictEqual(isDomainSuspicious('paypal-verification.tk'), true);
  assert.strictEqual(isDomainSuspicious('amazon-billing-support.com'), true);
});

test('Recognizes official brand domains as not suspicious', () => {
  assert.strictEqual(isDomainSuspicious('paypal.com'), false);
  assert.strictEqual(isDomainSuspicious('service.paypal.com'), false);
  assert.strictEqual(isDomainSuspicious('amazon.com'), false);
  assert.strictEqual(isDomainSuspicious('google.com'), false);
});

// 3. Heuristic Phishing Detection Tests
console.log('\n3. Heuristic Phishing Detector Tests:');
test('Flags high-urgency PayPal credential phishing email', () => {
  const phishingEmail = {
    subject: 'URGENT: Your Account Will Be Closed!',
    text: 'Dear Customer, We detected unusual activity on your PayPal account. Your account will be permanently suspended within 24 hours unless you verify your identity immediately. Click here to verify: http://paypal-security-update.ml/verify?token=abc123 Please update your password and credential now.',
    sender: {
      name: 'Security Team',
      email: 'security@paypal-verification.tk',
      domain: 'paypal-verification.tk'
    },
    links: [
      { href: 'http://paypal-security-update.ml/verify?token=abc123', text: 'Click here to verify' }
    ]
  };

  const result = heuristicDetect(phishingEmail);
  assert.strictEqual(result.label, 'phishing_email');
  assert.ok(result.confidence >= 0.65, `Expected confidence >= 0.65, got ${result.confidence}`);
  assert.ok(result.reasons.length > 0, 'Expected non-empty reasons list');
});

test('Classifies legitimate GitHub notification as safe', () => {
  const safeEmail = {
    subject: 'Your GitHub Security Alert',
    text: 'Hi there, We noticed a new sign-in to your GitHub account from Chrome on Linux. If this was you, no action is needed. You can review recent activity in your settings.',
    sender: {
      name: 'GitHub',
      email: 'noreply@github.com',
      domain: 'github.com'
    },
    links: [
      { href: 'https://github.com/settings/security', text: 'Security Settings' }
    ]
  };

  const result = heuristicDetect(safeEmail);
  assert.strictEqual(result.label, 'legitimate_email');
  assert.ok(result.confidence < 0.35, `Expected confidence < 0.35, got ${result.confidence}`);
});

test('Identifies mismatched link text phishing tactic', () => {
  const emailWithSpoofedLink = {
    subject: 'Account update notice',
    text: 'Please visit https://paypal.com to review your invoice.',
    sender: {
      name: 'Support',
      email: 'support@legit-looking.org',
      domain: 'legit-looking.org'
    },
    links: [
      { href: 'http://evil-attacker.top/phish', text: 'https://paypal.com' }
    ]
  };

  const result = heuristicDetect(emailWithSpoofedLink);
  assert.ok(result.reasons.some(r => r.includes('mismatches destination') || r.includes('suspicious link')));
});

// 4. Selector Configuration Tests
console.log('\n4. Email Provider Selector Tests:');
test('Resolves correct selectors for Gmail', () => {
  const gmailConfig = getSelectorsForCurrentSite({ hostname: 'mail.google.com', href: 'https://mail.google.com/mail/u/0/#inbox' });
  assert.strictEqual(gmailConfig.provider, 'gmail');
  assert.strictEqual(gmailConfig.variant, 'standard');
  assert.ok(gmailConfig.selectors.messages);
});

test('Resolves correct selectors for Outlook Live', () => {
  const outlookConfig = getSelectorsForCurrentSite({ hostname: 'outlook.live.com', href: 'https://outlook.live.com/mail/0/' });
  assert.strictEqual(outlookConfig.provider, 'outlook');
  assert.strictEqual(outlookConfig.variant, 'com');
  assert.ok(outlookConfig.selectors.messages);
});

test('Resolves correct selectors for Outlook Office 365', () => {
  const o365Config = getSelectorsForCurrentSite({ hostname: 'outlook.office365.com', href: 'https://outlook.office365.com/mail/' });
  assert.strictEqual(o365Config.provider, 'outlook');
  assert.strictEqual(o365Config.variant, 'office365');
});

// 5. Error Boundary & Utility Tests
console.log('\n5. Error Boundary & Utility Tests:');
test('safeText limits length correctly', () => {
  const mockEl = { textContent: '   Hello World!   ' };
  assert.strictEqual(safeText(mockEl, 5), 'Hello');
  assert.strictEqual(safeText(null), '');
});

test('safeAttr returns fallback when missing', () => {
  const mockEl = { getAttribute: (attr) => attr === 'data-id' ? '123' : null };
  assert.strictEqual(safeAttr(mockEl, 'data-id'), '123');
  assert.strictEqual(safeAttr(mockEl, 'email', 'default@domain.com'), 'default@domain.com');
  assert.strictEqual(safeAttr(null, 'email', 'fb'), 'fb');
});

test('generateId creates unique prefixed IDs', () => {
  const id1 = generateId('test');
  const id2 = generateId('test');
  assert.ok(id1.startsWith('test-'));
  assert.notStrictEqual(id1, id2);
});

console.log(`\n===================================`);
console.log(`Tests Passed: ${passedTests} | Failed: ${failedTests}`);
console.log(`===================================\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
