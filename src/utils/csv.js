import Papa from 'papaparse'

const COLUMNS = {
  date: ['Transaction Date', 'Date', 'transaction date', 'date'],
  description: ['Transaction Description', 'Description', 'transaction description', 'description'],
  amount: ['Amount', 'amount'],
  category: ['Category', 'category'],
  balance: ['Balance', 'balance'],
  type: ['Type', 'type'],
  typeDetail: ['Type Detail', 'Type Detail', 'type detail'],
}

function findColumnIndex(headers, possibleNames) {
  const lower = headers.map((h) => (h || '').toString().trim().toLowerCase())
  for (const name of possibleNames) {
    const i = lower.indexOf(name.toLowerCase())
    if (i !== -1) return i
  }
  return -1
}

/**
 * Parse a date string to YYYY-MM-DD.
 * Tries Date() first, then DD/MM/YYYY or DD-MM-YYYY if that fails.
 * @param {string} value
 * @returns {string|null}
 */
function parseDate(value) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  let d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) {
    const parts = trimmed.split(/[/\-]/)
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10)
      const p1 = parseInt(parts[1], 10)
      const p2 = parseInt(parts[2], 10)
      if (p0 > 31 && p1 <= 12 && p2 <= 31) {
        d = new Date(p0, p1 - 1, p2)
      } else if (p0 <= 31 && p1 <= 12 && p2 > 31) {
        d = new Date(p2, p1 - 1, p0)
      } else if (p0 <= 31 && p1 <= 12 && p2 <= 99) {
        const year = p2 < 100 ? 2000 + p2 : p2
        d = new Date(year, p1 - 1, p0)
      }
    }
  }
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Parse amount: strip currency, handle negatives.
 * Handles parentheses for negatives e.g. (29.99) => -29.99.
 * @param {string} value
 * @returns {number|null}
 */
function parseAmount(value) {
  if (value === '' || value === null || value === undefined) return null
  let str = String(value).replace(/[$,]/g, '').trim()
  const inParens = str.startsWith('(') && str.endsWith(')')
  if (inParens) str = str.slice(1, -1).trim()
  const num = parseFloat(str)
  if (Number.isNaN(num)) return null
  return inParens ? -Math.abs(num) : num
}

/**
 * Parse CSV file into rows of { date, description, amount, category? }.
 * @param {File} file
 * @returns {Promise<Array<{ date: string, description: string, amount: number, category?: string }>>}
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(result) {
        const { data, errors } = result
        if (errors.length && !data?.length) {
          reject(new Error(errors[0].message || 'CSV parse error'))
          return
        }
        const rows = data || []
        if (rows.length === 0) {
          resolve([])
          return
        }
        const headers = Object.keys(rows[0])
        const iDate = findColumnIndex(headers, COLUMNS.date)
        const iDesc = findColumnIndex(headers, COLUMNS.description)
        const iAmount = findColumnIndex(headers, COLUMNS.amount)
        const iCategory = findColumnIndex(headers, COLUMNS.category)
        const iBalance = findColumnIndex(headers, COLUMNS.balance)
        const iType = findColumnIndex(headers, COLUMNS.type)
        const iTypeDetail = findColumnIndex(headers, COLUMNS.typeDetail)

        if (iDate === -1 || iDesc === -1 || iAmount === -1) {
          reject(new Error('CSV must have columns: Transaction Date, Transaction Description, Amount'))
          return
        }

        const out = []
        for (const row of rows) {
          const values = Object.values(row)
          const dateStr = parseDate(values[iDate])
          const amount = parseAmount(values[iAmount])
          if (!dateStr || amount === null) continue
          const description = (values[iDesc] ?? '').toString().trim()
          const rec = { date: dateStr, description, amount }
          if (iCategory !== -1 && values[iCategory] != null && String(values[iCategory]).trim() !== '') {
            rec.category = String(values[iCategory]).trim()
          }
          if (iBalance !== -1) {
            rec.balance = parseAmount(values[iBalance])
          }
          if (iType !== -1) {
            rec.type = String(values[iType] ?? '').trim()
          }
          if (iTypeDetail !== -1) {
            rec.typeDetail = String(values[iTypeDetail] ?? '').trim()
          }
          out.push(rec)
        }
        resolve(out)
      },
      error(err) {
        reject(err)
      },
    })
  })
}

/**
 * Check if transaction (date + description + amount) exists in the list.
 * @param {{ date: string, description: string, amount: number }} transaction
 * @param {Array<{ date: string, description: string, amount: number }>} existingTransactions
 * @returns {boolean}
 */
export function isDuplicate(transaction, existingTransactions) {
  return existingTransactions.some(
    (t) =>
      t.date === transaction.date &&
      t.description === transaction.description &&
      t.amount === transaction.amount
  )
}
