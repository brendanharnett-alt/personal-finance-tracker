export default function MonthTabs({ months, selectedMonth, onSelectMonth }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {months.map((month) => (
        <button
          key={month}
          type="button"
          onClick={() => onSelectMonth(month)}
          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
            selectedMonth === month
              ? 'bg-neutral-800 text-white border-neutral-800'
              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
          }`}
        >
          {month}
        </button>
      ))}
    </div>
  )
}
