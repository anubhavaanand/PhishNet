import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, normalizeStoredSettings, validateSettingsPatch } from '../src/utils/settings-validation.mjs';

describe('persisted settings validation', () => {
  it('rejects corrupted values without discarding valid stored preferences', () => {
    const normalized = normalizeStoredSettings({
      autoScan: 'false',
      sensitivityThreshold: 900,
      highlightLinks: false,
      showTooltip: {},
      theme: 'unexpected',
      whitelist: ['trusted.example', null],
      attackerKey: 'untrusted',
    });
    assert.equal(normalized.autoScan, DEFAULT_SETTINGS.autoScan);
    assert.equal(normalized.sensitivityThreshold, DEFAULT_SETTINGS.sensitivityThreshold);
    assert.equal(normalized.highlightLinks, false);
    assert.equal(normalized.showTooltip, DEFAULT_SETTINGS.showTooltip);
    assert.equal(normalized.theme, DEFAULT_SETTINGS.theme);
    assert.deepEqual(normalized.whitelist, DEFAULT_SETTINGS.whitelist);
    assert.equal(Object.hasOwn(normalized, 'attackerKey'), false);
  });

  it('retains valid threshold boundaries and empty trust lists', () => {
    const normalized = normalizeStoredSettings({ sensitivityThreshold: 0, whitelist: [] });
    assert.equal(normalized.sensitivityThreshold, 0);
    assert.deepEqual(normalized.whitelist, []);
    assert.equal(validateSettingsPatch({ sensitivityThreshold: 1, whitelist: [] }), null);
  });

  it('does not share mutable default trust lists across loads', () => {
    const one = normalizeStoredSettings({});
    one.whitelist.push('changed.example');
    assert.equal(normalizeStoredSettings({}).whitelist.includes('changed.example'), false);

    const fromDefaults = normalizeStoredSettings(DEFAULT_SETTINGS);
    fromDefaults.whitelist.push('safe-to-edit.example');
    assert.equal(DEFAULT_SETTINGS.whitelist.includes('safe-to-edit.example'), false);
  });

  it('rejects missing or non-object patches', () => {
    for (const patch of [null, undefined, [], 'autoScan', false]) {
      assert.ok(validateSettingsPatch(patch));
    }
  });
});
