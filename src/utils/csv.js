import Papa from 'papaparse'

const COLUMNS = {
  date: ['Transaction Date', 'Date', 'transaction date', 'date'],
  description: ['Transaction Description', 'Description', 'transaction description', 'description'],
  amount: ['Amount', 'amount'],
  category: ['Category', 'category'],
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
 * @param {string} value
 * @returns {string|null}
 */
function parseDate(value) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Parse amount: strip currency, handle negatives.
 * @param {string} value
 * @returns {number|null}
 */
function parseAmount(value) {
  if (value === '' || value === null || value === undefined) return null
  const str = String(value).replace(/[$,]/g, '').trim()
  const num = parseFloat(str)
  if (Number.isNaN(num)) return null
  return num
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
