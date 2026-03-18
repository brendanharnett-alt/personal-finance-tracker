import { useState, useEffect, useCallback } from 'react'
import { loadFinanceData } from './utils/storage'
import UploadCSV from './components/UploadCSV'
import MonthTabs from './components/MonthTabs'
import TransactionGrid from './components/TransactionGrid'
import SpendHistogram from './components/SpendHistogram'

function App() {
  const [financeData, setFinanceData] = useState({ rules: {}, months: {} })
  const [selectedMonth, setSelectedMonth] = useState(null)

  const refresh = useCallback(() => {
    setFinanceData(loadFinanceData())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const monthKeys = Object.keys(financeData.months).sort((a, b) => (b > a ? 1 : -1))
  const transactions = selectedMonth ? (financeData.months[selectedMonth] || []) : []

  useEffect(() => {
    if (monthKeys.length === 0) return
    if (!selectedMonth || !monthKeys.includes(selectedMonth)) setSelectedMonth(monthKeys[0])
  }, [monthKeys, selectedMonth])

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-6 font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-medium">Personal Finance Tracker</h1>
      </header>

      <UploadCSV financeData={financeData} onRefresh={refresh} />

      {monthKeys.length > 0 && (
        <>
          <MonthTabs
            months={monthKeys}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
          />
          {selectedMonth && (
            <>
              <TransactionGrid
                transactions={transactions}
                financeData={financeData}
                selectedMonth={selectedMonth}
                onRefresh={refresh}
              />
              <SpendHistogram transactions={transactions} />
            </>
          )}
        </>
      )}

      {monthKeys.length === 0 && (
        <p className="text-neutral-500 mt-4">Upload a CSV to get started.</p>
      )}
      {monthKeys.length > 0 && !selectedMonth && (
        <p className="text-neutral-500 mt-4">Select a month above.</p>
      )}
    </div>
  )
}

export default App
