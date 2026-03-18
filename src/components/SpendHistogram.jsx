import { useMemo, useEffect } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function SpendHistogram({ transactions, chartMode = 'expense', onModeChange, onBarClick, selectedTypeName = null }) {
  const mode = chartMode ?? 'expense'
  const showIncome = mode === 'income'
  const showExpense = mode === 'expense'

  const rawData = useMemo(() => {
    const byType = {}
    for (const t of transactions) {
      const typeLabel = (t.type != null && String(t.type).trim() !== '') ? String(t.type).trim() : 'Uncategorized'
      if (!byType[typeLabel]) byType[typeLabel] = { income: 0, expense: 0 }
      if (t.amount > 0) {
        byType[typeLabel].income += t.amount
      } else if (t.amount < 0) {
        byType[typeLabel].expense += Math.abs(t.amount)
      }
    }
    const typeRows = Object.entries(byType).map(([name, { income, expense }]) => ({
      name,
      income: Math.round(income * 100) / 100,
      expense: Math.round(expense * 100) / 100,
    }))
    const totalIncome = typeRows.reduce((s, r) => s + r.income, 0)
    const totalExpense = typeRows.reduce((s, r) => s + r.expense, 0)
    return [
      ...typeRows,
      { name: 'Total', income: Math.round(totalIncome * 100) / 100, expense: Math.round(totalExpense * 100) / 100 },
    ]
  }, [transactions])

  const activeKey = showIncome ? 'income' : 'expense'

  const data = useMemo(() => {
    const filtered = rawData.filter(
      (row) => (showIncome && row.income > 0) || (showExpense && row.expense > 0)
    )
    const totalRow = filtered.find((r) => r.name === 'Total')
    const others = filtered.filter((r) => r.name !== 'Total').sort((a, b) => (b[activeKey] ?? 0) - (a[activeKey] ?? 0))
    return totalRow ? [totalRow, ...others] : others
  }, [rawData, showIncome, showExpense, activeKey])

  const totalsData = useMemo(() => {
    let totalIncome = 0
    let totalExpense = 0
    for (const t of transactions) {
      const amt = Number(t?.amount)
      if (!Number.isFinite(amt)) continue
      if (amt > 0) totalIncome += amt
      if (amt < 0) totalExpense += Math.abs(amt)
    }
    return [
      { name: 'Income', value: Math.round(totalIncome * 100) / 100 },
      { name: 'Expense', value: Math.round(totalExpense * 100) / 100 },
    ]
  }, [transactions])

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/59f16d9b-ce18-4b81-8b3f-6df2f0194bfe',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9b3957'},body:JSON.stringify({sessionId:'9b3957',location:'SpendHistogram.jsx:effect',message:'Chart received transactions',data:{transactionsLength:transactions.length,dataLength:data.length,dataCategories:data.map(d=>d.name)},timestamp:Date.now(),hypothesisId:'H3-H4'})}).catch(()=>{});
  }, [transactions, data, mode]);
  // #endregion

  const handleModeChange = (nextMode) => {
    if (onModeChange) onModeChange(nextMode)
  }

  const chartTitle = mode === 'all' ? 'Totals' : showIncome ? 'Income by type' : 'Expense by type'

  const handleBarClick = (e) => {
    if (mode === 'all') return
    if (!onBarClick) return
    const typeName = e?.payload?.name
    if (typeName == null) return
    if (typeName === 'Total' || typeName === selectedTypeName) {
      onBarClick(null)
    } else {
      onBarClick(typeName)
    }
  }

  const SegmentedControl = (
    <div className="flex rounded-lg border border-neutral-300 p-1 mb-4 w-fit">
      <button
        type="button"
        onClick={() => handleModeChange('all')}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          mode === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-600 hover:bg-neutral-100'
        }`}
      >
        All
      </button>
      <button
        type="button"
        onClick={() => handleModeChange('income')}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          showIncome ? 'bg-neutral-800 text-white' : 'text-neutral-600 hover:bg-neutral-100'
        }`}
      >
        Income
      </button>
      <button
        type="button"
        onClick={() => handleModeChange('expense')}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          showExpense ? 'bg-neutral-800 text-white' : 'text-neutral-600 hover:bg-neutral-100'
        }`}
      >
        Expense
      </button>
    </div>
  )

  if (mode === 'all') {
    return (
      <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium mb-2">{chartTitle}</h2>
        {SegmentedControl}
        <div className="overflow-x-auto">
          <div style={{ width: '100%', height: 320, overflowY: 'auto' }}>
            <div style={{ width: '100%', minHeight: 320, height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={totalsData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                  <Tooltip
                    formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name ?? '']}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {totalsData.map((entry, idx) => (
                      <Cell
                        key={`all-${idx}-${entry.name}`}
                        fill={entry.name === 'Income' ? '#22c55e' : '#64748b'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    const emptyMessage = showIncome ? 'No income in this period.' : 'No expenses in this period.'
    return (
      <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium mb-2">{chartTitle}</h2>
        {SegmentedControl}
        <p className="text-neutral-500 text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-white border border-neutral-200 rounded-lg shadow-sm">
      <h2 className="text-lg font-medium mb-2">{chartTitle}</h2>
      {SegmentedControl}
      <div className="overflow-x-auto">
        <div style={{ width: '100%', height: 320, overflowY: 'auto' }}>
          <div style={{ width: '100%', minHeight: 320, height: Math.max(320, data.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                <Tooltip
                  formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name ?? '']}
                  labelFormatter={(label) => label}
                />
                {showIncome && (
                  <Bar
                    dataKey="income"
                    fill="#22c55e"
                    radius={[0, 4, 4, 0]}
                    name="Income"
                    onClick={handleBarClick}
                    style={{ cursor: onBarClick ? 'pointer' : undefined }}
                  >
                    {data.map((entry, idx) => (
                      <Cell
                        key={`income-${idx}-${entry.name}`}
                        fill={entry.name === 'Total' ? '#0f172a' : '#22c55e'}
                        fillOpacity={
                          selectedTypeName == null || selectedTypeName === 'Total' || entry.name === selectedTypeName ? 1 : 0.4
                        }
                      />
                    ))}
                  </Bar>
                )}
                {showExpense && (
                  <Bar
                    dataKey="expense"
                    fill="#64748b"
                    radius={[0, 4, 4, 0]}
                    name="Expense"
                    onClick={handleBarClick}
                    style={{ cursor: onBarClick ? 'pointer' : undefined }}
                  >
                    {data.map((entry, idx) => (
                      <Cell
                        key={`expense-${idx}-${entry.name}`}
                        fill={entry.name === 'Total' ? '#0f172a' : '#64748b'}
                        fillOpacity={
                          selectedTypeName == null || selectedTypeName === 'Total' || entry.name === selectedTypeName ? 1 : 0.4
                        }
                      />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
