import { useState } from 'react'
import { parseCSV, isDuplicate } from '../utils/csv'
import { categorizeWithRules } from '../utils/classifier'
import { buildContextFromPriorMonths, categorizeWithLLM } from '../utils/llmCategorize'
import { loadFinanceData, saveFinanceData } from '../utils/storage'

export default function UploadCSV({ financeData, onRefresh }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setLoading(true)
    try {
      const rows = await parseCSV(file)
      if (rows.length === 0) {
        setError('No valid rows found in CSV.')
        setLoading(false)
        return
      }

      const { rules, months } = loadFinanceData()
      const allExisting = Object.values(months).flat()
      const newRows = rows.filter((r) => !isDuplicate(r, allExisting))
      if (newRows.length === 0) {
        setError('All rows are duplicates; nothing to add.')
        setLoading(false)
        return
      }

      const withRules = []
      const forLlm = []
      for (const row of newRows) {
        const category = row.category ?? categorizeWithRules(row.description, rules)
        if (category) {
          withRules.push({ ...row, category })
        } else {
          forLlm.push(row)
        }
      }

      if (forLlm.length > 0) {
        try {
          const monthKeys = Object.keys(months)
          const excludeMonth = monthKeys.length > 0 ? null : null
          const contextMonths = { ...months }
          const firstNewMonth = newRows[0]?.date?.slice(0, 7)
          const priorContext = buildContextFromPriorMonths(contextMonths, firstNewMonth)
          const categories = await categorizeWithLLM(forLlm, priorContext)
          forLlm.forEach((row, i) => {
            withRules.push({ ...row, category: categories[i] || 'Uncategorized' })
          })
        } catch (err) {
          forLlm.forEach((row) => {
            withRules.push({ ...row, category: 'Uncategorized' })
          })
          setError(`LLM categorization failed: ${err.message}. Uncategorized used for ${forLlm.length} row(s).`)
        }
      }

      const nextMonths = { ...months }
      for (const row of withRules) {
        const key = row.date.slice(0, 7)
        if (!nextMonths[key]) nextMonths[key] = []
        nextMonths[key].push(row)
      }
      saveFinanceData({ rules, months: nextMonths })
      onRefresh()
    } catch (err) {
      setError(err.message || 'Upload failed.')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="mb-6 p-4 bg-white border border-neutral-200 rounded-lg shadow-sm">
      <label className="block text-sm font-medium text-neutral-700 mb-2">Upload CSV</label>
      <input
        type="file"
        accept=".csv"
        onChange={handleFile}
        disabled={loading}
        className="block w-full text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200"
      />
      {loading && <p className="mt-2 text-sm text-neutral-500">Processing…</p>}
      {error && <p className="mt-2 text-sm text-amber-700">{error}</p>}
    </div>
  )
}
