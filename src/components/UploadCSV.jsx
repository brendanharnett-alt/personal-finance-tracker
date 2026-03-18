import { useState } from 'react'
import { parseCSV, isDuplicate } from '../utils/csv'
import { categorizeWithRules } from '../utils/classifier'
import { buildContextFromOtherTabs, categorizeWithLLM } from '../utils/llmCategorize'
import { loadFinanceData, saveFinanceData } from '../utils/storage'

function generateTabId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9)
}

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

      const { rules, tabs, tabOrder } = loadFinanceData()
      const withinFileDeduped = []
      const seen = new Set()
      for (const r of rows) {
        const key = `${r.date}|${r.description}|${r.amount}`
        if (seen.has(key)) continue
        seen.add(key)
        withinFileDeduped.push(r)
      }

      const withRules = []
      const forLlm = []
      for (const row of withinFileDeduped) {
        const category = row.category ?? categorizeWithRules(row.description, rules)
        if (category) {
          withRules.push({ ...row, category })
        } else {
          forLlm.push(row)
        }
      }

      if (forLlm.length > 0) {
        try {
          const priorContext = buildContextFromOtherTabs(tabs, null)
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

      const tabId = generateTabId()
      const label = file.name && file.name.trim() ? file.name.trim() : `Upload ${new Date().toLocaleString()}`
      const nextTabs = { ...tabs, [tabId]: { label, transactions: withRules } }
      const nextTabOrder = [...tabOrder, tabId]
      saveFinanceData({ rules, tabs: nextTabs, tabOrder: nextTabOrder })
      onRefresh(tabId)
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
