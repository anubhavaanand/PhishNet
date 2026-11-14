const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const path = require('node:path');

test('attachment extraction preserves files that share a name but differ in size or type', () => {
  const source = readFileSync(path.resolve(__dirname, '../src/content.js'), 'utf8');
  const marker = '  // Cleanup on unload';
  assert.ok(source.includes(marker));
  const instrumented = source.replace(marker, '  root.PhishNet.extractAttachmentsForTest = extractAttachments;\n' + marker);
  const root = { PhishNet: {} };

  runInNewContext(instrumented, {
    globalThis: root,
    window: { addEventListener() {} },
    document: { readyState: 'loading', addEventListener() {} },
    location: { href: 'https://mail.google.com/' },
    console
  });

  const file = (name, size, type) => ({
    textContent: name,
    getAttribute: (key) => ({ title: name, 'data-size': size, 'data-mime-type': type })[key] || null,
    closest() { return this; }
  });
  const rows = [
    file('report.pdf', '32 KB', 'application/pdf'),
    file('report.pdf', '64 KB', 'application/pdf'),
    file('report.pdf', '32 KB', 'image/png'),
    file('report.pdf', '32 KB', 'application/pdf'), // duplicate DOM match
    file('notes.txt', '', '')
  ];
  const element = {
    querySelectorAll: (selector) => selector === '[data-testid*="attachment"]' ? rows : []
  };

  assert.deepEqual(Array.from(root.PhishNet.extractAttachmentsForTest(element)), [
    'report.pdf', 'report.pdf', 'report.pdf', 'notes.txt'
  ]);
});
