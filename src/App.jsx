import { useState, useEffect, useCallback } from 'react'
import { loadFinanceData, saveFinanceData } from './utils/storage'
import UploadCSV from './components/UploadCSV'
import MonthTabs from './components/MonthTabs'
import TransactionGrid from './components/TransactionGrid'
import SpendHistogram from './components/SpendHistogram'

function App() {
  const [financeData, setFinanceData] = useState({ rules: {}, tabs: {}, tabOrder: [] })
  const [selectedTabId, setSelectedTabId] = useState(null)

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
                key={`chart-${selectedTabId}-${transactions.map((t) => t.category ?? '').join(',')}`}
                transactions={transactions}
              />
              <TransactionGrid
                transactions={transactions}
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
