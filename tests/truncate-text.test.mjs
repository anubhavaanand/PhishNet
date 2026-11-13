import test from 'node:test';
import assert from 'node:assert/strict';
import { truncateText } from '../src/utils/truncate-text.mjs';

test('retains ordinary text up to its approximate token budget', () => {
  assert.equal(truncateText('123456789', 2), '12345678');
  assert.equal(truncateText('12345678', 2), '12345678');
  assert.equal(truncateText('', 2), '');
});

test('does not split a surrogate pair at the boundary', () => {
  assert.equal(truncateText('1234567💌rest', 2), '1234567');
  assert.equal(truncateText('123456💌rest', 2), '123456💌');
  assert.equal(truncateText('1234567🔐rest', 2), '1234567');
});

test('preserves non-surrogate Unicode at the boundary', () => {
  assert.equal(truncateText('日本語安全e-mail', 1), '日本語安');
});
