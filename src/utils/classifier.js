/**
 * Normalize description for matching: uppercase, strip digits.
 * @param {string} description
 * @returns {string}
 */
export function normalizeDescription(description) {
  if (typeof description !== 'string') return ''
  return description.replace(/\d/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
}

/**
 * Return category from rules if any rule key appears in the normalized description.
 * @param {string} description
 * @param {Record<string, string>} rules  normalized keyword -> category
 * @returns {string|null}  category or null if no match
 */
export function categorizeWithRules(description, rules) {
  const normalized = normalizeDescription(description)
  if (!normalized) return null
  for (const [keyword, category] of Object.entries(rules)) {
    if (normalized.includes(keyword)) return category
  }
  return null
}
