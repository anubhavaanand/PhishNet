const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

test('sender trust is checked before short-email scanning is skipped', () => {
  const content = readFileSync(path.resolve(__dirname, '../src/content.js'), 'utf8');
  const whitelist = content.indexOf('if (isWhitelisted) {');
  const tooShort = content.indexOf('if (!emailContent.text || emailContent.text.length < 15) {');
  const modelScan = content.indexOf("type: 'SCAN_EMAIL'");

  assert.ok(whitelist !== -1 && tooShort !== -1 && modelScan !== -1);
  assert.ok(whitelist < tooShort, 'trusted senders must not be skipped for short content');
  assert.ok(tooShort < modelScan, 'short untrusted messages should still be skipped');
});
