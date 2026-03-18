import { useMemo, useEffect } from 'react'
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

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/59f16d9b-ce18-4b81-8b3f-6df2f0194bfe',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9b3957'},body:JSON.stringify({sessionId:'9b3957',location:'SpendHistogram.jsx:effect',message:'Chart received transactions',data:{transactionsLength:transactions.length,dataLength:data.length,dataCategories:data.map(d=>d.name)},timestamp:Date.now(),hypothesisId:'H3-H4'})}).catch(()=>{});
  }, [transactions, data]);
  // #endregion

  if (data.length === 0) {
    return (
      <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium mb-2">Spend by category</h2>
        <p className="text-neutral-500 text-sm">No expenses in this month.</p>
      </div>
    )
  }

  const minChartWidth = Math.max(400, data.length * 90)

  return (
    <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-sm">
      <h2 className="text-lg font-medium mb-4">Spend by category</h2>
      <div className="overflow-x-auto">
        <div style={{ minWidth: minChartWidth, height: 320 }}>
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
    </div>
  )
}
