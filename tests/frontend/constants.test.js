import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  VERDICT_META,
  getVerdictMeta,
  SENSITIVITY_LABELS,
  getSensitivityLabel,
  THEMES,
} from '@/lib/constants';

/**
 * These values are shared between the React UI and the service worker. The
 * worker's own defaults in src/background.js are asserted against
 * DEFAULT_SETTINGS by tests/package.test.js, so a drift here shows up there.
 */

describe('DEFAULT_SETTINGS', () => {
  it('has the keys the options page renders', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      autoScan: true,
      sensitivityThreshold: 0.7,
      highlightLinks: true,
      showTooltip: true,
      theme: 'auto',
    });
  });

  it('ships a usable whitelist', () => {
    expect(Array.isArray(DEFAULT_SETTINGS.whitelist)).toBe(true);
    expect(DEFAULT_SETTINGS.whitelist.length).toBeGreaterThan(0);
  });

  it('keeps the threshold in a sane range', () => {
    const t = DEFAULT_SETTINGS.sensitivityThreshold;
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThanOrEqual(1);
  });
});

describe('VERDICT_META', () => {
  const labels = [
    'phishing_email',
    'phishing_url',
    'legitimate_email',
    'legitimate_url',
    'trusted',
    'uncertain',
  ];

  it('covers every label the detector can return', () => {
    for (const label of labels) {
      expect(VERDICT_META[label], `missing meta for ${label}`).toBeDefined();
    }
  });

  it('gives each label the fields the UI reads', () => {
    for (const [label, meta] of Object.entries(VERDICT_META)) {
      expect(meta.title, `${label}.title`).toBeTruthy();
      expect(meta.short, `${label}.short`).toBeTruthy();
      expect(meta.color, `${label}.color`).toBeTruthy();
      expect(meta.icon, `${label}.icon`).toBeTruthy();
    }
  });

  it('falls back to uncertain for an unknown label', () => {
    const meta = getVerdictMeta('not_a_real_label');
    expect(meta).toBe(VERDICT_META.uncertain);
  });

  it('returns the exact entry for a known label', () => {
    expect(getVerdictMeta('phishing_email')).toBe(VERDICT_META.phishing_email);
  });
});

describe('sensitivity labels', () => {
  it('is ordered from cautious to strict', () => {
    const values = SENSITIVITY_LABELS.map((s) => s.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it('resolves a percentage to its label', () => {
    expect(getSensitivityLabel(0.7).label).toBe('Standard');
  });

  it('rounds before matching', () => {
    expect(getSensitivityLabel(0.695).label).toBe('Standard');
  });

  it('falls back to the default for an unmatched value', () => {
    const fallback = getSensitivityLabel(0.123);
    expect(fallback).toBe(SENSITIVITY_LABELS[2]);
  });
});

describe('THEMES', () => {
  it('offers auto, light and dark', () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids).toEqual(['auto', 'light', 'dark']);
  });

  it('matches the theme values the worker persists', () => {
    expect(THEMES.map((t) => t.id)).toContain(DEFAULT_SETTINGS.theme);
  });
});