/**
 * Light TR/EN query normalization for hybrid search.
 * Keeps English business jargon intact; folds Turkish case loosely.
 */
export function normalizeMeetingQuery(query: string): string {
  return query
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR')
}

/** Extract distinctive terms (including EN jargon) for soft matching hints. */
export function extractQueryTerms(query: string): string[] {
  const normalized = normalizeMeetingQuery(query)
  const terms = normalized
    .split(/[^\p{L}\p{N}_%./+-]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
  // Prefer keeping uppercase-looking jargon from original (ARR, CAC…)
  const jargon = (query.match(/\b[A-Z]{2,}(?:\/[A-Z]+)?\b/g) ?? []).map((j) => j.toLowerCase())
  return [...new Set([...terms, ...jargon])]
}
