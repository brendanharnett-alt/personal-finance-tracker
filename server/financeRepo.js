const db = require('./db')

/**
 * Migrate legacy months shape to tabs (same as frontend storage.js).
 * @param {{ rules?: Object, months?: Object, tabs?: Object, tabOrder?: string[] }} data
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

function rowToTransaction(row) {
  const t = {
    id: row.id,
    date: row.date,
    description: row.description,
    amount: row.amount,
    category: row.category,
  }
  if (row.balance != null) t.balance = row.balance
  if (row.type != null) t.type = row.type
  if (row.type_detail != null) t.typeDetail = row.type_detail
  if (row.type_fill_source != null && row.type_fill_source !== '') t.typeFillSource = row.type_fill_source
  return t
}

function getFinanceState() {
  const rulesRows = db.prepare('SELECT keyword, category FROM rules').all()
  const rules = {}
  for (const r of rulesRows) {
    rules[r.keyword] = r.category
  }

  const tabRows = db.prepare('SELECT id, label, sort_index FROM tabs ORDER BY sort_index ASC, id ASC').all()
  const tabOrder = tabRows.map((t) => t.id)
  const tabs = {}

  const txStmt = db.prepare(`
    SELECT id, tab_id, amount, category, description, date, balance, type, type_detail, type_fill_source
    FROM transactions
    WHERE tab_id = ?
    ORDER BY id ASC
  `)

  for (const tr of tabRows) {
    const txRows = txStmt.all(tr.id)
    tabs[tr.id] = {
      label: tr.label,
      transactions: txRows.map(rowToTransaction),
    }
  }

  return { rules, tabs, tabOrder }
}

function replaceFinanceState(data) {
  const normalized = migrateFromMonths(data)
  const rules = normalized.rules ?? {}
  const tabs = normalized.tabs ?? {}
  const tabOrder = Array.isArray(normalized.tabOrder) ? normalized.tabOrder : []

  const insertRule = db.prepare('INSERT INTO rules (keyword, category) VALUES (?, ?)')
  const insertTab = db.prepare('INSERT INTO tabs (id, label, sort_index) VALUES (?, ?, ?)')
  const insertTx = db.prepare(`
    INSERT INTO transactions (tab_id, amount, category, description, date, balance, type, type_detail, type_fill_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertTxWithId = db.prepare(`
    INSERT INTO transactions (id, tab_id, amount, category, description, date, balance, type, type_detail, type_fill_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const run = db.transaction(() => {
    db.prepare('DELETE FROM transactions').run()
    db.prepare('DELETE FROM tabs').run()
    db.prepare('DELETE FROM rules').run()

    for (const [keyword, category] of Object.entries(rules)) {
      insertRule.run(keyword, String(category))
    }

    tabOrder.forEach((tabId, i) => {
      const tab = tabs[tabId]
      if (!tab) return
      insertTab.run(tabId, tab.label ?? tabId, i)
      const list = Array.isArray(tab.transactions) ? tab.transactions : []
      for (const t of list) {
        const amount = t.amount != null ? Number(t.amount) : null
        const category = t.category != null ? String(t.category) : null
        const description = t.description != null ? String(t.description) : null
        const date = t.date != null ? String(t.date) : null
        const balance = t.balance != null && t.balance !== '' ? Number(t.balance) : null
        const type = t.type != null ? String(t.type) : null
        const typeDetail = t.typeDetail != null ? String(t.typeDetail) : null
        const typeFillSource = t.typeFillSource != null ? String(t.typeFillSource) : null
        const existingId = t.id != null && Number.isFinite(Number(t.id)) && Number(t.id) > 0 ? Math.floor(Number(t.id)) : null
        if (existingId) {
          insertTxWithId.run(
            existingId,
            tabId,
            amount,
            category,
            description,
            date,
            balance,
            type,
            typeDetail,
            typeFillSource
          )
        } else {
          insertTx.run(tabId, amount, category, description, date, balance, type, typeDetail, typeFillSource)
        }
      }
    })
  })

  run()
}

/**
 * One-time import from localStorage-shaped JSON. Idempotent if DB already has tabs (returns skipped).
 */
function migrateFromPayload(body) {
  const normalized = migrateFromMonths(body)
  const tabCount = db.prepare('SELECT COUNT(*) AS c FROM tabs').get().c
  if (tabCount > 0) {
    return { skipped: true, reason: 'Database already contains tabs. Use PUT /api/finance to replace, or delete server/finance.db to re-import.' }
  }
  replaceFinanceState(normalized)
  return { skipped: false, migrated: true }
}

function getAllTransactionsFlat() {
  return db
    .prepare(
      `
    SELECT id, tab_id, amount, category, description, date, balance, type, type_detail, type_fill_source
    FROM transactions
    ORDER BY tab_id ASC, id ASC
  `
    )
    .all()
}

function insertTransaction(payload) {
  const tabId = payload.tabId ?? payload.tab_id
  if (!tabId) throw new Error('tabId required')
  const tabExists = db.prepare('SELECT 1 FROM tabs WHERE id = ?').get(tabId)
  if (!tabExists) throw new Error(`Unknown tab id: ${tabId}`)

  const result = db
    .prepare(
      `
    INSERT INTO transactions (tab_id, amount, category, description, date, balance, type, type_detail, type_fill_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      tabId,
      payload.amount != null ? Number(payload.amount) : null,
      payload.category != null ? String(payload.category) : null,
      payload.description != null ? String(payload.description) : null,
      payload.date != null ? String(payload.date) : null,
      payload.balance != null && payload.balance !== '' ? Number(payload.balance) : null,
      payload.type != null ? String(payload.type) : null,
      payload.typeDetail != null ? String(payload.typeDetail) : null,
      payload.typeFillSource != null ? String(payload.typeFillSource) : null
    )

  const id = result.lastInsertRowid
  const row = db
    .prepare(
      `
    SELECT id, tab_id, amount, category, description, date, balance, type, type_detail, type_fill_source
    FROM transactions WHERE id = ?
  `
    )
    .get(id)
  return row
}

function deleteTransactionById(id) {
  const n = db.prepare('DELETE FROM transactions WHERE id = ?').run(Number(id))
  return n.changes
}

module.exports = {
  migrateFromMonths,
  getFinanceState,
  replaceFinanceState,
  migrateFromPayload,
  getAllTransactionsFlat,
  insertTransaction,
  deleteTransactionById,
}
