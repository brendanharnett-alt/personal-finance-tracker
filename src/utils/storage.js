const STORAGE_KEY = 'finance_data'

const defaultData = () => ({
  rules: {},
  months: {},
})

/**
 * Load finance data from localStorage.
 * @returns {{ rules: Object, months: Object }}
 */
export function loadFinanceData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    const data = JSON.parse(raw)
    return {
      rules: data.rules ?? {},
      months: data.months ?? {},
    }
  } catch {
    return defaultData()
  }
}

/**
 * Save finance data to localStorage.
 * @param {{ rules: Object, months: Object }} data
 */
export function saveFinanceData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      rules: data.rules ?? {},
      months: data.months ?? {},
    }))
  } catch (e) {
    console.error('Failed to save finance data:', e)
  }
}
