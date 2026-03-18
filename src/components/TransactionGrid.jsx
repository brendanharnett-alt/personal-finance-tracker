import { useCallback, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

ModuleRegistry.registerModules([AllCommunityModule])
import { normalizeDescription } from '../utils/classifier'
import { loadFinanceData, saveFinanceData } from '../utils/storage'

export default function TransactionGrid({ transactions, financeData, selectedTabId, onRefresh, onTabTransactionsUpdate }) {
  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      resizable: true,
      floatingFilter: true,
    }),
    []
  )

  const columnDefs = useMemo(
    () => [
      { field: 'date', headerName: 'Date', filter: 'agTextColumnFilter', filterParams: { filterOptions: ['contains'] }, width: 120 },
      { field: 'description', headerName: 'Description', filter: 'agTextColumnFilter', filterParams: { filterOptions: ['contains', 'equals', 'startsWith', 'endsWith'] }, flex: 1 },
      {
        field: 'amount',
        headerName: 'Amount',
        editable: true,
        filter: 'agNumberColumnFilter',
        width: 120,
        valueFormatter: (p) => (p.value != null ? Number(p.value).toFixed(2) : ''),
        valueParser: (params) => {
          if (params.newValue == null || params.newValue === '') return null
          const n = Number(String(params.newValue).replace(/[$,]/g, ''))
          return Number.isNaN(n) ? null : n
        },
      },
      {
        field: 'category',
        headerName: 'Category',
        editable: true,
        filter: 'agSetColumnFilter',
        width: 160,
      },
    ],
    []
  )

  const onCellValueChanged = useCallback(
    (event) => {
      const field = event.colDef?.field
      if (field !== 'category' && field !== 'amount') return
      if (event.data == null) return

      const { rules, tabs, tabOrder } = loadFinanceData()
      if (!selectedTabId) return
      const tab = tabs[selectedTabId]
      if (!tab || !Array.isArray(tab.transactions)) return
      const list = tab.transactions

      const idx = list.findIndex(
        (t) =>
          t.date === event.data.date &&
          t.description === event.data.description &&
          (field === 'amount' ? t.amount === event.oldValue : t.amount === event.data.amount)
      )
      if (idx === -1) return

      const nextList = [...list]
      if (field === 'category') {
        const newCategory = event.newValue?.trim()
        if (!newCategory) return
        nextList[idx] = { ...nextList[idx], category: newCategory }
        const key = normalizeDescription(event.data.description)
        if (key) {
          const nextRules = { ...rules, [key]: newCategory }
          saveFinanceData({ rules: nextRules, tabs: { ...tabs, [selectedTabId]: { ...tab, transactions: nextList } }, tabOrder })
        } else {
          saveFinanceData({ rules, tabs: { ...tabs, [selectedTabId]: { ...tab, transactions: nextList } }, tabOrder })
        }
      } else {
        const newAmount = event.newValue != null && event.newValue !== '' ? Number(event.newValue) : null
        if (newAmount === null || Number.isNaN(newAmount)) return
        nextList[idx] = { ...nextList[idx], amount: newAmount }
        saveFinanceData({ rules, tabs: { ...tabs, [selectedTabId]: { ...tab, transactions: nextList } }, tabOrder })
      }

      if (onTabTransactionsUpdate) onTabTransactionsUpdate(selectedTabId, nextList)
    },
    [selectedTabId, onTabTransactionsUpdate]
  )

  const getRowId = useCallback(
    (params) => `${params.rowIndex}-${params.data.date}-${params.data.description}`,
    []
  )

  return (
    <div className="ag-theme-quartz mb-6" style={{ height: 400, width: '100%' }}>
      <AgGridReact
        rowData={transactions}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onCellValueChanged={onCellValueChanged}
        getRowId={getRowId}
        suppressCellFocus={false}
      />
    </div>
  )
}
