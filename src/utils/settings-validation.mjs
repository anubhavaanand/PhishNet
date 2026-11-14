/** Shared validation for incoming settings and values restored from storage. */
export const DEFAULT_SETTINGS = Object.freeze({
  autoScan: true,
  sensitivityThreshold: 0.7,
  highlightLinks: true,
  showTooltip: true,
  theme: 'auto',
  whitelist: Object.freeze(['github.com', 'google.com', 'microsoft.com', 'amazon.com', 'apple.com']),
});

const booleanSettings = new Set(['autoScan', 'highlightLinks', 'showTooltip']);
const allowedThemes = new Set(['auto', 'aloe', 'graphite', 'dusk', 'light', 'dark']);

function isValidSetting(key, value) {
  if (booleanSettings.has(key)) return typeof value === 'boolean';
  if (key === 'sensitivityThreshold') {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
  }
  if (key === 'theme') return allowedThemes.has(value);
  if (key === 'whitelist') {
    return Array.isArray(value) && value.every(
      (entry) => typeof entry === 'string' && entry.trim().length > 0
    );
  }
  return false;
}

export function validateSettingsPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return 'settings must be an object';
  }
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key)) return `Unknown setting: ${key}`;
    if (!isValidSetting(key, value)) return `Invalid ${key} setting`;
  }
  return null;
}

/** Ignore invalid stored fields individually, retaining legitimate preferences. */
export function normalizeStoredSettings(stored) {
  const source = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => {
    const value = source[key];
    const validated = isValidSetting(key, value) ? value : fallback;
    // Whitelists are mutable in the worker; never share a stored or frozen array.
    return [key, Array.isArray(validated) ? [...validated] : validated];
  }));
}
