import { useCallback, useMemo, useEffect, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

ModuleRegistry.registerModules([AllCommunityModule])
import { normalizeDescription } from '../utils/classifier'
import { loadFinanceData, saveFinanceData } from '../utils/storage'
import SetFilterWithAdvanced, { doesFilterPassSetWithAdvanced } from './SetFilterWithAdvanced'

export default function TransactionGrid({ transactions, financeData, selectedTabId, onRefresh, onTabTransactionsUpdate }) {
  const tooltipLogCount = useRef(0)

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      resizable: true,
      floatingFilter: true,
    }),
    []
  )

  const setFilterWithAdvanced = useMemo(
    () => ({
      component: SetFilterWithAdvanced,
      doesFilterPass: doesFilterPassSetWithAdvanced,
    }),
    []
  )

  const columnDefs = useMemo(() => {
    const base = [
      { field: 'date', headerName: 'Date', filter: setFilterWithAdvanced, width: 120 },
      {
        field: 'description',
        headerName: 'Description',
        filter: setFilterWithAdvanced,
        flex: 1,
        // Show full description on hover (the cell text may be truncated due to width).
        tooltipValueGetter: (p) => {
          if (tooltipLogCount.current < 3) {
            tooltipLogCount.current += 1
            // #region agent log
            fetch('http://127.0.0.1:7269/ingest/c0461200-55a8-4957-bf70-a3b436ca4734', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '674b9d' },
              body: JSON.stringify({
                sessionId: '674b9d',
                location: 'TransactionGrid.jsx:descriptionTooltipValueGetter',
                message: 'description tooltipValueGetter called',
                hypothesisId: 'H2',
                data: {
                  value: p?.value ?? null,
                  row: p?.data ?? null,
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {})
            // #endregion
          }
          return p?.value ?? ''
        },
      },
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
        filter: setFilterWithAdvanced,
        width: 160,
      },
    ]
    const first = transactions.length ? transactions[0] : null
    if (first && 'balance' in first) {
      base.push({
        field: 'balance',
        headerName: 'Balance',
        editable: true,
        filter: 'agNumberColumnFilter',
        width: 120,
        valueFormatter: (p) => (p.value != null ? Number(p.value).toFixed(2) : ''),
        valueParser: (params) => {
          if (params.newValue == null || params.newValue === '') return null
          const n = Number(String(params.newValue).replace(/[$,]/g, ''))
          return Number.isNaN(n) ? null : n
        },
      })
    }
    if (first && 'type' in first) {
      base.push({ field: 'type', headerName: 'Type', editable: true, filter: setFilterWithAdvanced, width: 120 })
    }
    if (first && 'typeDetail' in first) {
      base.push({ field: 'typeDetail', headerName: 'Type Detail', editable: true, filter: setFilterWithAdvanced, width: 140 })
    }
    return base
  }, [transactions, setFilterWithAdvanced])

  const onCellValueChanged = useCallback(
    (event) => {
      const field = event.colDef?.field
      const editableFields = ['category', 'amount', 'balance', 'type', 'typeDetail']
      if (!editableFields.includes(field)) return
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
      } else if (field === 'amount') {
        const newAmount = event.newValue != null && event.newValue !== '' ? Number(event.newValue) : null
        if (newAmount === null || Number.isNaN(newAmount)) return
        nextList[idx] = { ...nextList[idx], amount: newAmount }
        saveFinanceData({ rules, tabs: { ...tabs, [selectedTabId]: { ...tab, transactions: nextList } }, tabOrder })
      } else if (field === 'balance') {
        const newBalance = event.newValue != null && event.newValue !== '' ? Number(event.newValue) : null
        if (newBalance !== null && Number.isNaN(newBalance)) return
        nextList[idx] = { ...nextList[idx], balance: newBalance }
        saveFinanceData({ rules, tabs: { ...tabs, [selectedTabId]: { ...tab, transactions: nextList } }, tabOrder })
      } else if (field === 'type' || field === 'typeDetail') {
        const newValue = event.newValue != null ? String(event.newValue).trim() : ''
        nextList[idx] = { ...nextList[idx], [field]: newValue }
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

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7269/ingest/c0461200-55a8-4957-bf70-a3b436ca4734', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '674b9d' },
      body: JSON.stringify({
        sessionId: '674b9d',
        location: 'TransactionGrid.jsx:mount',
        message: 'TransactionGrid mounted; tooltip config snapshot',
        hypothesisId: 'H1',
        data: {
          enableBrowserTooltips: true,
          descriptionTooltipConfigured: true,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }, [])

  return (
    <div className="ag-theme-quartz mb-6" style={{ height: 400, width: '100%' }}>
      <AgGridReact
        rowData={transactions}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onCellValueChanged={onCellValueChanged}
        getRowId={getRowId}
        suppressCellFocus={false}
        enableBrowserTooltips
        enableFilterHandlers
      />
    </div>
  )
}
