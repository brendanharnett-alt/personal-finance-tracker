import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function SpendHistogram({ transactions }) {
  const data = useMemo(() => {
    const byCategory = {}
    for (const t of transactions) {
      if (t.amount < 0) {
        const cat = t.category || 'Uncategorized'
        byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount)
      }
    }
    return Object.entries(byCategory).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
  }, [transactions])

  if (data.length === 0) {
    return (
      <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium mb-2">Spend by category</h2>
        <p className="text-neutral-500 text-sm">No expenses in this month.</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-sm">
      <h2 className="text-lg font-medium mb-4">Spend by category</h2>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Spend']} />
            <Bar dataKey="value" fill="#64748b" radius={[4, 4, 0, 0]} name="Spend" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
