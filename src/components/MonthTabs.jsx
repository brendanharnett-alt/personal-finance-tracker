import { useState, useRef, useEffect } from 'react'

export default function MonthTabs({ tabOrder, tabs, selectedTabId, onSelectTab, onDeleteTab, onRenameTab }) {
  const [editingTabId, setEditingTabId] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTabId])

  const commitRename = (tabId, value) => {
    const trimmed = value != null ? String(value).trim() : ''
    if (trimmed && onRenameTab) onRenameTab(tabId, trimmed)
    setEditingTabId(null)
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4 items-center">
      {tabOrder.map((tabId) => {
        const tab = tabs[tabId]
        const label = tab?.label ?? tabId
        const isSelected = selectedTabId === tabId
        const isEditing = editingTabId === tabId
        return (
          <div
            key={tabId}
            className={`flex items-center gap-1 rounded-lg border text-sm font-medium transition-colors ${
              isSelected
                ? 'bg-neutral-800 text-white border-neutral-800'
                : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
            }`}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                defaultValue={label}
                className="px-3 py-1.5 min-w-[80px] max-w-[200px] rounded border border-neutral-400 bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500"
                onBlur={(e) => commitRename(tabId, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitRename(tabId, e.target.value)
                  } else if (e.key === 'Escape') {
                    setEditingTabId(null)
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <button
                type="button"
                onClick={() => onSelectTab(tabId)}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  if (onRenameTab) setEditingTabId(tabId)
                }}
                className="px-4 py-2 text-left min-w-0 truncate max-w-[200px]"
                title={`${label} (double-click to rename)`}
              >
                {label}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteTab(tabId)
              }}
              className="p-2 rounded-r-md hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/50"
              title="Delete tab"
              aria-label="Delete tab"
            >
              <span className="sr-only">Delete</span>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
