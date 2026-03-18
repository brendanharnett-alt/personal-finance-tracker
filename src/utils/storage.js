const STORAGE_KEY = 'finance_data'

const defaultData = () => ({
  rules: {},
  tabs: {},
  tabOrder: [],
})

/**
 * Migrate legacy months data to tabs (one tab per month).
 * @param {{ rules: Object, months?: Object, tabs?: Object, tabOrder?: string[] }} data
 * @returns {{ rules: Object, tabs: Object, tabOrder: string[] }}
 */
function migrateFromMonths(data) {
  if (data.tabs != null && Array.isArray(data.tabOrder)) {
    return {
      rules: data.rules ?? {},
      tabs: data.tabs ?? {},
      tabOrder: data.tabOrder ?? [],
    }
  }
  const months = data.months ?? {}
  const tabOrder = Object.keys(months).sort((a, b) => (b > a ? 1 : -1))
  const tabs = {}
  for (const id of tabOrder) {
    tabs[id] = { label: id, transactions: Array.isArray(months[id]) ? months[id] : [] }
  }
  return {
    rules: data.rules ?? {},
    tabs,
    tabOrder,
  }
}

/**
 * Load finance data from localStorage.
 * @returns {{ rules: Object, tabs: Object, tabOrder: string[] }}
 */
export function loadFinanceData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    const data = JSON.parse(raw)
    return migrateFromMonths(data)
  } catch {
    return defaultData()
  }
}

/**
 * Save finance data to localStorage.
 * @param {{ rules: Object, tabs: Object, tabOrder: string[] }} data
 */
export function saveFinanceData(data) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rules: data.rules ?? {},
        tabs: data.tabs ?? {},
        tabOrder: data.tabOrder ?? [],
      })
    )
  } catch (e) {
    console.error('Failed to save finance data:', e)
  }
}
