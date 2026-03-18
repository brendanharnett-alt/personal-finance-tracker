import { useState, useEffect, useCallback, useMemo } from 'react'
import { loadFinanceData, saveFinanceData } from './utils/storage'
import UploadCSV from './components/UploadCSV'
import MonthTabs from './components/MonthTabs'
import TransactionGrid from './components/TransactionGrid'
import SpendHistogram from './components/SpendHistogram'

const defaultChartVisibility = () => ({ showIncome: false, showExpense: true })

function App() {
  const [financeData, setFinanceData] = useState({ rules: {}, tabs: {}, tabOrder: [] })
  const [selectedTabId, setSelectedTabId] = useState(null)
  const [chartVisibilityByTabId, setChartVisibilityByTabId] = useState({})
  const [chartDrillDownByTabId, setChartDrillDownByTabId] = useState({})

  const refresh = useCallback((selectTabId = null) => {
    const data = loadFinanceData()
    // #region agent log
    const firstTabId = data.tabOrder?.[0]
    const tab = firstTabId ? data.tabs?.[firstTabId] : null
    const tx = tab?.transactions ?? []
    fetch('http://127.0.0.1:7242/ingest/59f16d9b-ce18-4b81-8b3f-6df2f0194bfe',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9b3957'},body:JSON.stringify({sessionId:'9b3957',location:'App.jsx:refresh',message:'Refresh called, data loaded',data:{tabOrderLength:data.tabOrder?.length,firstTabId,transactionsLength:tx.length,categoriesSample:tx.slice(0,5).map(t=>t.category)},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    setFinanceData(data)
    if (selectTabId != null) setSelectedTabId(selectTabId)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const { tabs = {}, tabOrder = [] } = financeData
  const transactions = selectedTabId && tabs[selectedTabId] ? tabs[selectedTabId].transactions || [] : []

  const getTypeLabel = useCallback((t) =>
    (t.type != null && String(t.type).trim() !== '') ? String(t.type).trim() : 'Uncategorized', [])

  const selectedChartType = selectedTabId ? (chartDrillDownByTabId[selectedTabId] ?? null) : null
  const filteredTransactions = useMemo(() => {
    if (selectedChartType == null || selectedChartType === 'Total') return transactions
    return transactions.filter((t) => getTypeLabel(t) === selectedChartType)
  }, [transactions, selectedChartType, getTypeLabel])

  const handleBarClick = useCallback((tabId, typeName) => {
    setChartDrillDownByTabId((prev) => ({ ...prev, [tabId]: typeName }))
  }, [])

  useEffect(() => {
    if (tabOrder.length === 0) return
    if (!selectedTabId || !tabOrder.includes(selectedTabId)) setSelectedTabId(tabOrder[0])
  }, [tabOrder, selectedTabId])

  const handleDeleteTab = useCallback(
    (tabId) => {
      const { rules, tabs: currentTabs, tabOrder: currentOrder } = loadFinanceData()
      const nextOrder = currentOrder.filter((id) => id !== tabId)
      const nextTabs = { ...currentTabs }
      delete nextTabs[tabId]
      saveFinanceData({ rules, tabs: nextTabs, tabOrder: nextOrder })
      setFinanceData({ rules, tabs: nextTabs, tabOrder: nextOrder })
      setChartVisibilityByTabId((prev) => {
        const next = { ...prev }
        delete next[tabId]
        return next
      })
      setChartDrillDownByTabId((prev) => {
        const next = { ...prev }
        delete next[tabId]
        return next
      })
      if (selectedTabId === tabId) setSelectedTabId(nextOrder[0] ?? null)
    },
    [selectedTabId]
  )

  const handleTabTransactionsUpdate = useCallback((tabId, updatedTransactions) => {
    setFinanceData((prev) => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        [tabId]: { ...prev.tabs[tabId], transactions: updatedTransactions },
      },
    }))
  }, [])

  const chartVisibilityRaw = selectedTabId
    ? (chartVisibilityByTabId[selectedTabId] ?? defaultChartVisibility())
    : defaultChartVisibility()
  const chartVisibility = useMemo(() => {
    const { showIncome, showExpense } = chartVisibilityRaw
    if (showIncome) return { showIncome: true, showExpense: false }
    return { showIncome: false, showExpense: true }
  }, [chartVisibilityRaw])

  const handleChartTogglesChange = useCallback((tabId, next) => {
    setChartVisibilityByTabId((prev) => ({ ...prev, [tabId]: next }))
  }, [])

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-6 font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-medium">Personal Finance Tracker</h1>
      </header>

      <UploadCSV financeData={financeData} onRefresh={refresh} />

      {tabOrder.length > 0 && (
        <>
          <MonthTabs
            tabOrder={tabOrder}
            tabs={tabs}
            selectedTabId={selectedTabId}
            onSelectTab={setSelectedTabId}
            onDeleteTab={handleDeleteTab}
          />
          {selectedTabId && (
            <>
              <SpendHistogram
                key={`chart-${selectedTabId}`}
                transactions={transactions}
                showIncome={chartVisibility.showIncome}
                showExpense={chartVisibility.showExpense}
                onTogglesChange={(next) => handleChartTogglesChange(selectedTabId, next)}
                onBarClick={(typeName) => handleBarClick(selectedTabId, typeName)}
                selectedTypeName={selectedChartType}
              />
              {selectedChartType != null && selectedChartType !== 'Total' && (
                <div className="flex items-center gap-2 mb-2 text-sm text-neutral-600">
                  <span>Showing: {selectedChartType}</span>
                  <button
                    type="button"
                    onClick={() => handleBarClick(selectedTabId, null)}
                    className="px-2 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50"
                  >
                    Clear
                  </button>
                </div>
              )}
              <TransactionGrid
                transactions={filteredTransactions}
                financeData={financeData}
                selectedTabId={selectedTabId}
                onRefresh={refresh}
                onTabTransactionsUpdate={handleTabTransactionsUpdate}
              />
            </>
          )}
        </>
      )}

      {tabOrder.length === 0 && (
        <p className="text-neutral-500 mt-4">Upload a CSV to get started.</p>
      )}
      {tabOrder.length > 0 && !selectedTabId && (
        <p className="text-neutral-500 mt-4">Select a tab above.</p>
      )}
    </div>
  )
}

export default App
