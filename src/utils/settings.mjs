/**
 * Validate preferences read from persistent storage. Storage can contain data
 * written by an older release, a bug, or a manual edit; it is not trusted.
 *
 * Keep this separate from message-update policy: a bad stored field must not
 * prevent the remaining valid preferences from loading.
 */
const MAX_WHITELIST_ENTRIES = 100;
const MAX_ENTRY_LENGTH = 254;
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const EMAIL_LOCAL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;

function validDomain(value) {
  if (value.length > 253) return false;
  const labels = value.split('.');
  return labels.length >= 2 && labels.every(label => DOMAIN_LABEL.test(label));
}

function normalizeTrustedEntry(value) {
  if (typeof value !== 'string') return null;
  const entry = value.trim().toLowerCase();
  if (!entry || entry.length > MAX_ENTRY_LENGTH) return null;

  const at = entry.indexOf('@');
  if (at === -1) return validDomain(entry) ? entry : null;

  const local = entry.slice(0, at);
  const domain = entry.slice(at + 1);
  if (!local || local.length > 64 || local.startsWith('.') ||
      local.endsWith('.') || local.includes('..') || !EMAIL_LOCAL.test(local)) {
    return null;
  }
  return validDomain(domain) ? entry : null;
}

function normalizeWhitelist(value) {
  const result = [];
  const seen = new Set();
  for (const original of value) {
    const entry = normalizeTrustedEntry(original);
    if (entry && !seen.has(entry)) {
      result.push(entry);
      seen.add(entry);
      if (result.length === MAX_WHITELIST_ENTRIES) break;
    }
  }
  return result;
}

/** Only the known settings keys are returned; malformed values are discarded. */
export function normalizeStoredSettings(stored, defaults, allowedThemes) {
  const input = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  const result = {};

  for (const key of ['autoScan', 'highlightLinks', 'showTooltip']) {
    result[key] = typeof input[key] === 'boolean' ? input[key] : defaults[key];
  }

  const threshold = input.sensitivityThreshold;
  result.sensitivityThreshold = typeof threshold === 'number' &&
    Number.isFinite(threshold) && threshold >= 0 && threshold <= 1
    ? threshold : defaults.sensitivityThreshold;

  result.theme = allowedThemes.includes(input.theme) ? input.theme : defaults.theme;

  // An absent key is a first-run install; a malformed saved list is *not*.
  // An invalid list must fail closed instead of restoring default trust entries.
  result.whitelist = input.whitelist === undefined
    ? [...defaults.whitelist]
    : Array.isArray(input.whitelist) ? normalizeWhitelist(input.whitelist) : [];

  return result;
}
