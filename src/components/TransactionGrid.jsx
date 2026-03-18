import { useCallback, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

ModuleRegistry.registerModules([AllCommunityModule])
import { normalizeDescription } from '../utils/classifier'
import { loadFinanceData, saveFinanceData } from '../utils/storage'

export default function TransactionGrid({ transactions, financeData, selectedMonth, onRefresh }) {
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
      { field: 'amount', headerName: 'Amount', filter: 'agNumberColumnFilter', width: 120, valueFormatter: (p) => (p.value != null ? Number(p.value).toFixed(2) : '') },
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
      if (event.colDef?.field !== 'category' || event.data == null) return
      const newCategory = event.newValue?.trim()
      if (!newCategory) return
      const { rules, months } = loadFinanceData()
      const key = normalizeDescription(event.data.description)
      if (key) {
        const nextRules = { ...rules, [key]: newCategory }
        const monthList = months[selectedMonth] || []
        const idx = monthList.findIndex(
          (t) => t.date === event.data.date && t.description === event.data.description && t.amount === event.data.amount
        )
        if (idx !== -1) {
          const nextList = [...monthList]
          nextList[idx] = { ...nextList[idx], category: newCategory }
          saveFinanceData({ rules: nextRules, months: { ...months, [selectedMonth]: nextList } })
          onRefresh()
        }
      }
    },
    [selectedMonth, onRefresh]
  )

  const getRowId = useCallback((params) => params.data.date + '|' + params.data.description + '|' + params.data.amount, [])

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
