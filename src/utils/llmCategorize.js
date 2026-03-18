/**
 * Build context string from prior months: description -> category for LLM.
 * @param {Record<string, Array<{ description: string, category: string }>>} months
 * @param {string} excludeMonth  e.g. "2025-03" to skip that month
 * @returns {string}
 */
export function buildContextFromPriorMonths(months, excludeMonth) {
  const pairs = []
  for (const [monthKey, transactions] of Object.entries(months)) {
    if (monthKey === excludeMonth || !Array.isArray(transactions)) continue
    for (const t of transactions) {
      if (t.description && t.category) {
        pairs.push(`${t.description} -> ${t.category}`)
      }
    }
  }
  return pairs.length ? pairs.join('\n') : ''
}

/**
 * Call backend to categorize transactions using LLM. Returns array of category strings (one per row).
 * @param {Array<{ date: string, description: string, amount: number }>} transactions
 * @param {string} priorContext  description -> category from prior months
 * @returns {Promise<string[]>}
 */
export async function categorizeWithLLM(transactions, priorContext) {
  const res = await fetch('/api/categorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactions: transactions.map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
      })),
      priorContext,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `Categorize failed: ${res.status}`)
  }
  const data = await res.json()
  if (!Array.isArray(data.categories) || data.categories.length !== transactions.length) {
    throw new Error('Invalid categorize response')
  }
  return data.categories
}
