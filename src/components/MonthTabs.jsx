export default function MonthTabs({ tabOrder, tabs, selectedTabId, onSelectTab, onDeleteTab }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4 items-center">
      {tabOrder.map((tabId) => {
        const tab = tabs[tabId]
        const label = tab?.label ?? tabId
        const isSelected = selectedTabId === tabId
        return (
          <div
            key={tabId}
            className={`flex items-center gap-1 rounded-lg border text-sm font-medium transition-colors ${
              isSelected
                ? 'bg-neutral-800 text-white border-neutral-800'
                : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectTab(tabId)}
              className="px-4 py-2 text-left min-w-0 truncate max-w-[200px]"
              title={label}
            >
              {label}
            </button>
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
