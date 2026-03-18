import { useState, useEffect, useCallback, useMemo } from 'react'

const ADVANCED_OPTIONS = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
]

function applyCondition(type, filterValue, cellValue) {
  if (filterValue == null || String(filterValue).trim() === '') return true
  const str = cellValue != null ? String(cellValue) : ''
  const f = String(filterValue).trim().toLowerCase()
  const s = str.toLowerCase()
  switch (type) {
    case 'contains':
      return s.includes(f)
    case 'equals':
      return s === f
    case 'startsWith':
      return s.startsWith(f)
    case 'endsWith':
      return s.endsWith(f)
    default:
      return s.includes(f)
  }
}

export function doesFilterPassSetWithAdvanced(params) {
  const model = params.model
  if (model == null) return true
  const getValue = params.handlerParams?.getValue ?? params.getValue ?? (() => null)
  const node = params.node
  const value = typeof getValue === 'function' ? getValue(node) : null
  if (model.mode === 'set') {
    const selected = model.selected
    if (!Array.isArray(selected) || selected.length === 0) return true
    const cellStr = value != null ? String(value).trim() : ''
    return selected.includes(cellStr)
  }
  if (model.mode === 'advanced' && model.type != null) {
    return applyCondition(model.type, model.filter, value)
  }
  return true
}

export default function SetFilterWithAdvanced({ model, onModelChange, getValue, api, column }) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [distinctValues, setDistinctValues] = useState([])
  const [advancedType, setAdvancedType] = useState('contains')
  const [advancedFilter, setAdvancedFilter] = useState('')

  const currentModel = model ?? { mode: 'set', selected: [] }
  const selectedSet = useMemo(() => {
    const sel = currentModel.mode === 'set' && Array.isArray(currentModel.selected) ? currentModel.selected : []
    return new Set(sel)
  }, [currentModel])

  useEffect(() => {
    if (!api || !getValue || !column) return
    const values = new Set()
    api.forEachLeafNode((node) => {
      const v = getValue(node)
      const s = v != null ? String(v).trim() : ''
      if (s !== '') values.add(s)
    })
    setDistinctValues(Array.from(values).sort())
  }, [api, getValue, column])

  useEffect(() => {
    if (currentModel.mode === 'advanced') {
      setAdvancedType(currentModel.type ?? 'contains')
      setAdvancedFilter(currentModel.filter ?? '')
      setShowAdvanced(true)
    }
  }, [])

  const toggleValue = useCallback(
    (value) => {
      const next = new Set(selectedSet)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      onModelChange({ mode: 'set', selected: Array.from(next) })
    },
    [selectedSet, onModelChange]
  )

  const selectAll = useCallback(() => {
    onModelChange({ mode: 'set', selected: [...distinctValues] })
  }, [distinctValues, onModelChange])

  const deselectAll = useCallback(() => {
    onModelChange({ mode: 'set', selected: [] })
  }, [onModelChange])

  const switchToAdvanced = useCallback(() => {
    setShowAdvanced(true)
    setAdvancedType('contains')
    setAdvancedFilter('')
    onModelChange({ mode: 'advanced', type: 'contains', filter: '' })
  }, [onModelChange])

  const applyAdvanced = useCallback(
    (type, filter) => {
      onModelChange({ mode: 'advanced', type, filter: filter || '' })
    },
    [onModelChange]
  )

  const clearFilter = useCallback(() => {
    onModelChange(null)
    setShowAdvanced(false)
    setAdvancedFilter('')
  }, [onModelChange])

  return (
    <div className="ag-set-filter-with-advanced p-2 min-w-[200px] max-h-[320px] overflow-auto">
      {!showAdvanced ? (
        <>
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={selectAll} className="text-xs text-neutral-600 hover:underline">
              Select All
            </button>
            <button type="button" onClick={deselectAll} className="text-xs text-neutral-600 hover:underline">
              Deselect All
            </button>
          </div>
          <ul className="space-y-1 mb-2 max-h-[220px] overflow-y-auto">
            {distinctValues.map((val) => (
              <li key={val} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`chk-${val}`}
                  checked={selectedSet.has(val)}
                  onChange={() => toggleValue(val)}
                  className="rounded border-neutral-300"
                />
                <label htmlFor={`chk-${val}`} className="text-sm truncate cursor-pointer flex-1">
                  {val || '(blank)'}
                </label>
              </li>
            ))}
          </ul>
          <button type="button" onClick={switchToAdvanced} className="text-xs text-blue-600 hover:underline">
            Advanced
          </button>
        </>
      ) : (
        <>
          <div className="space-y-2 mb-2">
            <select
              value={advancedType}
              onChange={(e) => applyAdvanced(e.target.value, advancedFilter)}
              className="w-full text-sm border border-neutral-300 rounded px-2 py-1"
            >
              {ADVANCED_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={advancedFilter}
              onChange={(e) => {
                setAdvancedFilter(e.target.value)
                applyAdvanced(advancedType, e.target.value)
              }}
              placeholder="Filter value..."
              className="w-full text-sm border border-neutral-300 rounded px-2 py-1"
            />
          </div>
          <button
              type="button"
              onClick={() => {
                setShowAdvanced(false)
                onModelChange({ mode: 'set', selected: [] })
              }}
              className="text-xs text-neutral-600 hover:underline mr-2"
            >
              Back to list
            </button>
          <button type="button" onClick={clearFilter} className="text-xs text-neutral-600 hover:underline">
            Clear
          </button>
        </>
      )}
    </div>
  )
}
