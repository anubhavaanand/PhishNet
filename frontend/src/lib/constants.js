/**
 * Default settings — mirrors src/background.js defaults
 */
export const DEFAULT_SETTINGS = {
  autoScan: true,
  sensitivityThreshold: 0.7,
  highlightLinks: true,
  showTooltip: true,
  whitelist: ['github.com', 'google.com', 'microsoft.com', 'amazon.com', 'apple.com'],
};

/**
 * Verdict metadata for scan results.
 * Maps label strings to display info: icon, title, color tokens, class.
 */
export const VERDICT_META = {
  phishing_email: {
    icon: 'alert',
    title: 'Phishing Threat',
    short: 'Phishing',
    color: 'rose',
    cssClass: 'phishing',
  },
  phishing_url: {
    icon: 'link-alert',
    title: 'Phishing Link',
    short: 'Bad Link',
    color: 'rose',
    cssClass: 'phishing',
  },
  legitimate_email: {
    icon: 'shield',
    title: 'Safe Email',
    short: 'Safe',
    color: 'green',
    cssClass: 'safe',
  },
  legitimate_url: {
    icon: 'link-safe',
    title: 'Safe Link',
    short: 'Safe Link',
    color: 'green',
    cssClass: 'safe',
  },
  trusted: {
    icon: 'star',
    title: 'Trusted Sender',
    short: 'Trusted',
    color: 'gold',
    cssClass: 'trusted',
  },
  uncertain: {
    icon: 'question',
    title: 'Uncertain — Take a Closer Look',
    short: 'Uncertain',
    color: 'amber',
    cssClass: 'uncertain',
  },
};

export function getVerdictMeta(label) {
  return VERDICT_META[label] || VERDICT_META.uncertain;
}

/**
 * Sensitivity slider presets for friendly labels
 */
export const SENSITIVITY_LABELS = [
  { value: 50, label: 'Cautious', desc: 'More alerts, fewer misses' },
  { value: 60, label: 'Balanced', desc: 'Good middle ground' },
  { value: 70, label: 'Standard', desc: 'Recommended default' },
  { value: 80, label: 'Selective', desc: 'Fewer false positives' },
  { value: 90, label: 'Strict', desc: 'Only high-confidence threats' },
  { value: 95, label: 'Very Strict', desc: 'Minimal alerts' },
];

export function getSensitivityLabel(value) {
  const pct = Math.round(value * 100);
  return SENSITIVITY_LABELS.find((s) => s.value === pct) || SENSITIVITY_LABELS[2];
}

/**
 * Theme options
 */
export const THEMES = [
  { id: 'auto', name: 'Auto', desc: 'Follow system' },
  { id: 'light', name: 'Light', desc: 'Bright & friendly' },
  { id: 'dark', name: 'Dark', desc: 'Cozy & warm' },
];
