/** Truncate to an approximate token budget without bisecting UTF-16 pairs. */
export function truncateText(text, maxTokens) {
  if (!text) return '';
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;

  const truncated = text.slice(0, maxChars);
  // JS slicing counts UTF-16 code units, not Unicode code points. Removing a
  // high surrogate at the boundary avoids sending a broken emoji to the model.
  return /[\uD800-\uDBFF]$/.test(truncated)
    ? truncated.slice(0, -1)
    : truncated;
}
