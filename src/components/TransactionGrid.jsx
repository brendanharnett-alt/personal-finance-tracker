import { useCallback, useMemo, useEffect, useRef, useState } from 'react'
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
  const gridApiRef = useRef(null)
  const savedColumnStateRef = useRef(null)

  const allTabTransactions = selectedTabId && financeData?.tabs?.[selectedTabId] ? financeData.tabs[selectedTabId].transactions || [] : []
  const hasTypeColumn = allTabTransactions.length > 0 && Object.prototype.hasOwnProperty.call(allTabTransactions[0], 'type')
  const hasBalanceColumn = allTabTransactions.length > 0 && Object.prototype.hasOwnProperty.call(allTabTransactions[0], 'balance')
  const hasTypeDetailColumn = allTabTransactions.length > 0 && Object.prototype.hasOwnProperty.call(allTabTransactions[0], 'typeDetail')
  const isBlankType = (v) => v == null || String(v).trim() === ''
  const blankTypeTargetCount = hasTypeColumn ? allTabTransactions.filter((t) => isBlankType(t.type) && (t.description ?? '').toString().trim() !== '').length : 0
  const tabOrder = financeData?.tabOrder ?? []
  const otherTabIds = tabOrder.filter((id) => id !== selectedTabId)

  const [trainingK, setTrainingK] = useState(3)
  const [trainingTabIds, setTrainingTabIds] = useState([])
  const [aiTypeFillRunning, setAiTypeFillRunning] = useState(false)
  const [aiTypeFillError, setAiTypeFillError] = useState(null)
  const [aiTypeFillProgressDone, setAiTypeFillProgressDone] = useState(0)
  const [aiTypeFillProgressTotal, setAiTypeFillProgressTotal] = useState(0)
  const [selectedAmountSum, setSelectedAmountSum] = useState(null)

  const AMOUNT_EPSILON = 1e-6
  const normalizeAmountForCompare = useCallback((v) => {
    if (v == null || v === '') return null
    const n = Number(v)
    if (!Number.isFinite(n)) return null
    return n
  }, [])

  useEffect(() => {
    if (!selectedTabId) return
    const k = Math.min(3, otherTabIds.length)
    setTrainingK(k)
    setTrainingTabIds(otherTabIds.slice(-k))
    setAiTypeFillError(null)
  }, [selectedTabId])

  const onGridReady = useCallback((params) => {
    gridApiRef.current = params.api
  }, [])

  const onColumnResized = useCallback((params) => {
    if (params.finished && params.api) {
      const state = params.api.getColumnState()
      if (state && state.length > 0) {
        // Preserve the user's resize/layout, but do NOT persist sort.
        // Persisting sort here causes the grid sort model to be overwritten when rowData updates
        // (e.g. when editing `type` removes/re-inserts the row due to filtering).
        savedColumnStateRef.current = state.map((c) => {
          // Remove sort fields entirely so applyColumnState doesn't overwrite the user's current sort.
          // eslint-disable-next-line no-unused-vars
          const { sort, sortIndex, ...rest } = c
          return rest
        })
      }
    }
  }, [])

  useEffect(() => {
    if (!savedColumnStateRef.current || !gridApiRef.current) return
    const api = gridApiRef.current
    // Extra safety: ensure sort isn't accidentally present even if older saved state exists.
    const state = savedColumnStateRef.current.map((c) => {
      // eslint-disable-next-line no-unused-vars
      const { sort, sortIndex, ...rest } = c
      return rest
    })
    const timer = setTimeout(() => {
      try {
        api.applyColumnState({ state, applyOrder: false })
      } catch (_) {}
    }, 10)
    return () => clearTimeout(timer)
  }, [selectedTabId, hasBalanceColumn, hasTypeColumn, hasTypeDetailColumn])

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
    if (hasBalanceColumn) {
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
    if (hasTypeColumn) {
      base.push({
        field: 'type',
        headerName: 'Type',
        editable: true,
        filter: setFilterWithAdvanced,
        width: 120,
        cellStyle: (params) => {
          if (params?.data?.typeFillSource === 'ai') {
            return { backgroundColor: '#fde68a' }
          }
          return undefined
        },
      })
    }
    if (hasTypeDetailColumn) {
      base.push({ field: 'typeDetail', headerName: 'Type Detail', editable: true, filter: setFilterWithAdvanced, width: 140 })
    }
    return base
  }, [hasBalanceColumn, hasTypeColumn, hasTypeDetailColumn, setFilterWithAdvanced])

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

      const desiredAmount =
        field === 'amount' ? normalizeAmountForCompare(event.oldValue) : normalizeAmountForCompare(event.data.amount)

      const idx = list.findIndex(
        (t) =>
          t.date === event.data.date &&
          t.description === event.data.description &&
          (() => {
            if (desiredAmount == null) return true // Fall back to date+description match.
            const tAmt = normalizeAmountForCompare(t.amount)
            if (tAmt == null) return false
            return Math.abs(tAmt - desiredAmount) <= AMOUNT_EPSILON
          })()
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
      } else if (field === 'type') {
        const newValue = event.newValue != null ? String(event.newValue).trim() : ''
        nextList[idx] = { ...nextList[idx], type: newValue, typeFillSource: undefined }
        saveFinanceData({ rules, tabs: { ...tabs, [selectedTabId]: { ...tab, transactions: nextList } }, tabOrder })
      } else if (field === 'typeDetail') {
        const newValue = event.newValue != null ? String(event.newValue).trim() : ''
        nextList[idx] = { ...nextList[idx], typeDetail: newValue }
        saveFinanceData({ rules, tabs: { ...tabs, [selectedTabId]: { ...tab, transactions: nextList } }, tabOrder })
      }

      if (onTabTransactionsUpdate) onTabTransactionsUpdate(selectedTabId, nextList)
    },
    [selectedTabId, onTabTransactionsUpdate]
  )

  const getRowId = useCallback(
    (params) => {
      // Avoid `rowIndex` so row identity stays stable when filtering (Income/Expense modes).
      const amt = params.data?.amount
      const amtN = Number(amt)
      const amtKey = Number.isFinite(amtN) ? String(amtN) : ''
      return `${params.data?.date ?? ''}-${params.data?.description ?? ''}-${amtKey}`
    },
    []
  )

  const onSelectionChanged = useCallback((event) => {
    const api = event.api
    if (!api) {
      setSelectedAmountSum(null)
      return
    }
    const rows = api.getSelectedRows()
    if (!rows || rows.length === 0) {
      setSelectedAmountSum(null)
      return
    }
    let sum = 0
    for (const row of rows) {
      if (row && typeof row.amount === 'number' && Number.isFinite(row.amount)) {
        sum += row.amount
      } else if (row && row.amount != null) {
        const n = Number(row.amount)
        if (Number.isFinite(n)) sum += n
      }
    }
    setSelectedAmountSum(sum)
  }, [])

  const handleTrainingKChange = useCallback(
    (e) => {
      const nextK = Number(e.target.value)
      const k = Number.isFinite(nextK) && nextK > 0 ? nextK : 1
      setTrainingK(k)
      setTrainingTabIds(otherTabIds.slice(-k))
      setAiTypeFillError(null)
    },
    [otherTabIds]
  )

  const handleTrainingTabIdsChange = useCallback((e) => {
    const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value)
    setTrainingTabIds(selected)
    setTrainingK(Math.max(1, selected.length))
    setAiTypeFillError(null)
  }, [])

  const handleAiTypeFill = useCallback(async () => {
    if (!selectedTabId || !hasTypeColumn) return
    if (aiTypeFillRunning) return
    if (trainingTabIds.length === 0) {
      setAiTypeFillError('Select at least one dataset (training tab).')
      return
    }
    if (blankTypeTargetCount === 0) {
      setAiTypeFillError('No blank Type cells found in this tab.')
      return
    }

    setAiTypeFillRunning(true)
    setAiTypeFillError(null)
    setAiTypeFillProgressDone(0)
    try {
      const { rules, tabs, tabOrder } = loadFinanceData()
      const currentTab = tabs[selectedTabId]
      const currentList = currentTab?.transactions ?? []

      const targetIndices = []
      const targets = []
      for (let i = 0; i < currentList.length; i += 1) {
        const t = currentList[i]
        if (isBlankType(t?.type) && (t?.description ?? '').toString().trim() !== '') {
          targetIndices.push(i)
          targets.push({ description: (t.description ?? '').toString().trim() })
        }
      }

      if (targets.length === 0) {
        setAiTypeFillError('No blank Type cells found (with non-empty Description).')
        return
      }

      setAiTypeFillProgressTotal(targets.length)

      const pairSeen = new Set()
      const trainingPairs = []
      for (const tabId of trainingTabIds) {
        const tabTx = tabs[tabId]?.transactions ?? []
        for (const t of tabTx) {
          const desc = (t?.description ?? '').toString().trim()
          const ty = (t?.type ?? '').toString().trim()
          if (!desc || !ty) continue
          const key = `${desc}|${ty}`
          if (pairSeen.has(key)) continue
          pairSeen.add(key)
          trainingPairs.push({ description: desc, type: ty })
        }
      }

      const MAX_TRAINING_PAIRS = 400
      const cappedPairs = trainingPairs.slice(0, MAX_TRAINING_PAIRS)
      const typeSet = new Set(cappedPairs.map((p) => p.type))
      const types = Array.from(typeSet)

      if (cappedPairs.length === 0) {
        setAiTypeFillError('No training pairs found. Make sure your training tabs have Type filled.')
        return
      }

      // Work progressively, but ensure each successful batch produces a new array reference.
      // This prevents stale memoization in parent components/graphs that depend on array identity.
      let nextList = [...currentList]

      const BATCH_SIZE = 15

      const fillTargetsBatch = async (chunkTargetIndices, chunkTargets) => {
        const res = await fetch('/api/type-fill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trainingPairs: cappedPairs,
            types,
            targets: chunkTargets,
          }),
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `type-fill failed: ${res.status}`)
        }

        const data = await res.json()
        const recommended = data?.types
        if (!Array.isArray(recommended) || recommended.length !== chunkTargets.length) {
          throw new Error('Invalid type-fill LLM response shape')
        }

        // Copy once per successful batch so downstream memoization sees a new array reference.
        const updatedList = [...nextList]

        for (let i = 0; i < chunkTargetIndices.length; i += 1) {
          const idx = chunkTargetIndices[i]
          updatedList[idx] = { ...updatedList[idx], type: recommended[i] ?? '', typeFillSource: 'ai' }
        }

        nextList = updatedList

        saveFinanceData({
          rules,
          tabs: { ...tabs, [selectedTabId]: { ...currentTab, transactions: updatedList } },
          tabOrder,
        })
        if (onTabTransactionsUpdate) onTabTransactionsUpdate(selectedTabId, updatedList)
        setAiTypeFillProgressDone((d) => d + chunkTargets.length)
      }

      const fillTargetsBatchWithRetry = async (chunkTargetIndices, chunkTargets) => {
        try {
          await fillTargetsBatch(chunkTargetIndices, chunkTargets)
        } catch (e) {
          const msg = e?.message || ''
          const lower = msg.toLowerCase()
          if (
            lower.includes('invalid type-fill llm response shape')
          ) {
            if (chunkTargets.length <= 1) throw e
            const mid = Math.floor(chunkTargets.length / 2)
            const leftIndices = chunkTargetIndices.slice(0, mid)
            const leftTargets = chunkTargets.slice(0, mid)
            const rightIndices = chunkTargetIndices.slice(mid)
            const rightTargets = chunkTargets.slice(mid)
            await fillTargetsBatchWithRetry(leftIndices, leftTargets)
            await fillTargetsBatchWithRetry(rightIndices, rightTargets)
            return
          }
          throw e
        }
      }

      for (let start = 0; start < targets.length; start += BATCH_SIZE) {
        const chunkTargetIndices = targetIndices.slice(start, start + BATCH_SIZE)
        const chunkTargets = targets.slice(start, start + BATCH_SIZE)
        await fillTargetsBatchWithRetry(chunkTargetIndices, chunkTargets)
      }
    } catch (e) {
      setAiTypeFillError(e?.message || 'AI Type Fill failed.')
    } finally {
      setAiTypeFillRunning(false)
    }
  }, [aiTypeFillRunning, blankTypeTargetCount, hasTypeColumn, onTabTransactionsUpdate, selectedTabId, trainingTabIds, isBlankType])

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
    <div className="mb-6">
      {hasTypeColumn && (
        <div className="flex flex-wrap items-start gap-3 mb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAiTypeFill}
              disabled={aiTypeFillRunning || trainingTabIds.length === 0 || blankTypeTargetCount === 0}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                aiTypeFillRunning || trainingTabIds.length === 0 || blankTypeTargetCount === 0
                  ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                  : 'bg-neutral-800 text-white hover:bg-neutral-700'
              }`}
            >
              {aiTypeFillRunning
                ? `Filling Types… (${aiTypeFillProgressDone}/${aiTypeFillProgressTotal || blankTypeTargetCount || 0})`
                : 'Use AI Type Fill'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-600">Training tabs</label>
            <select
              value={trainingK}
              onChange={handleTrainingKChange}
              className="border border-neutral-300 rounded px-2 py-1 text-sm bg-white"
              disabled={aiTypeFillRunning || otherTabIds.length === 0}
            >
              {Array.from({ length: Math.max(1, Math.min(6, otherTabIds.length || 1)) }, (_, i) => {
                const v = i + 1
                return (
                  <option key={v} value={v}>
                    {v}
                  </option>
                )
              })}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-neutral-600 mb-1">Datasets</label>
            <select
              multiple
              value={trainingTabIds}
              onChange={handleTrainingTabIdsChange}
              className="border border-neutral-300 rounded px-2 py-1 text-sm bg-white h-28 w-64"
              disabled={aiTypeFillRunning || otherTabIds.length === 0}
            >
              {otherTabIds.map((tabId) => {
                const label = financeData?.tabs?.[tabId]?.label ?? tabId
                return (
                  <option key={tabId} value={tabId}>
                    {label}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      )}

      {hasTypeColumn && aiTypeFillRunning && aiTypeFillProgressTotal > 0 && (
        <div className="w-full mb-3">
          <div className="text-xs text-neutral-600 mb-1">
            Filled {aiTypeFillProgressDone} / {aiTypeFillProgressTotal}
          </div>
          <div className="h-2 bg-neutral-200 rounded overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-[width] duration-200"
              style={{
                width: `${Math.max(0, Math.min(100, (aiTypeFillProgressDone / aiTypeFillProgressTotal) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {aiTypeFillError && <div className="text-sm text-amber-700 mb-3">{aiTypeFillError}</div>}

      {selectedAmountSum != null && (
        <div className="text-sm text-neutral-600 mb-2">
          Selected (Amount): <strong>${Number(selectedAmountSum).toFixed(2)}</strong>
        </div>
      )}

      <div className="ag-theme-quartz" style={{ height: 400, width: '100%' }}>
        <AgGridReact
          rowData={transactions}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCellValueChanged}
          getRowId={getRowId}
          suppressCellFocus={false}
          enableBrowserTooltips
          enableFilterHandlers
          rowSelection="multiple"
          rowMultiSelectWithClick
          onSelectionChanged={onSelectionChanged}
          onGridReady={onGridReady}
          onColumnResized={onColumnResized}
        />
      </div>
    </div>
  )
}
