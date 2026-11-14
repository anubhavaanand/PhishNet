// Keep popup-triggered scans scoped to the same mail origins as the manifest's
// content script. Exact hosts prevent lookalike subdomains from being trusted.
const MAIL_HOSTS = new Set([
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'outlook.office365.com'
]);

export function isSupportedMailTabUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && MAIL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
