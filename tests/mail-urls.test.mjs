import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isSupportedMailTabUrl } from '../src/utils/mail-urls.mjs';

test('popup scan accepts the four hosts with extension content scripts', () => {
  for (const host of ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'outlook.office365.com']) {
    assert.equal(isSupportedMailTabUrl(`https://${host}/mail/u/0/#inbox`), true, host);
  }
});

test('allowed hosts stay synchronized with manifest content-script matches', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const origins = manifest.content_scripts.flatMap(({ matches }) => matches);
  for (const origin of origins) {
    assert.equal(isSupportedMailTabUrl(origin.replace('*', 'inbox')), true, origin);
  }
});

test('popup scan rejects non-mail, lookalike, and restricted URLs', () => {
  for (const url of [
    'https://example.com',
    'https://mail.google.com.evil.example/',
    'https://mail.google.com@evil.example/',
    'https://outlook.com/',
    'http://mail.google.com/',
    'chrome://extensions/',
    'about:blank',
    'not a URL',
    undefined,
    null
  ]) {
    assert.equal(isSupportedMailTabUrl(url), false, String(url));
  }
});
