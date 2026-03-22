const STORAGE_KEY = 'finance_data'
const SELECTED_TAB_KEY = 'finance_selected_tab_id'

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
 * Load finance data from the API (SQLite backend).
 * @returns {Promise<{ rules: Object, tabs: Object, tabOrder: string[] }>}
 */
export async function loadFinanceData() {
  try {
    const res = await fetch('/api/finance')
    if (!res.ok) return defaultData()
    const data = await res.json()
    return migrateFromMonths(data)
  } catch {
    return defaultData()
  }
}

/**
 * Save finance data via API (full replace in SQLite).
 * @param {{ rules: Object, tabs: Object, tabOrder: string[] }} data
 * @returns {Promise<void>}
 */
export async function saveFinanceData(data) {
  try {
    const res = await fetch('/api/finance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rules: data.rules ?? {},
        tabs: data.tabs ?? {},
        tabOrder: data.tabOrder ?? [],
      }),
    })
    if (!res.ok) {
      const t = await res.text()
      console.error('Failed to save finance data:', t || res.status)
    }
  } catch (e) {
    console.error('Failed to save finance data:', e)
  }
}

/**
 * One-time migration: read legacy localStorage blob and POST to /api/migrate, then remove the old key.
 * Call manually from the console if needed: import { migrateLocalStorageToApi } from './utils/storage'
 */
export async function migrateLocalStorageToApi() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { skipped: true, reason: 'No localStorage finance_data' }
    const body = JSON.parse(raw)
    const res = await fetch('/api/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && !json.skipped) {
      localStorage.removeItem(STORAGE_KEY)
    }
    return json
  } catch (e) {
    console.error(e)
    return { error: e.message }
  }
}

/**
 * Get the last selected tab id from localStorage (restore on refresh).
 * @returns {string|null}
 */
export function getSelectedTabId() {
  try {
    const id = localStorage.getItem(SELECTED_TAB_KEY)
    return id && id.length > 0 ? id : null
  } catch {
    return null
  }
}

/**
 * Persist the selected tab id so it can be restored on refresh.
 * @param {string} tabId
 */
export function setSelectedTabIdStorage(tabId) {
  try {
    if (tabId != null && tabId !== '') {
      localStorage.setItem(SELECTED_TAB_KEY, tabId)
    } else {
      localStorage.removeItem(SELECTED_TAB_KEY)
    }
  } catch (e) {
    console.error('Failed to save selected tab id:', e)
  }
}
