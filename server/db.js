const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, 'finance.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tabs (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      sort_index INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rules (
      keyword TEXT PRIMARY KEY,
      category TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      balance REAL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tab_id TEXT NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
      amount REAL,
      category TEXT,
      description TEXT,
      date TEXT,
      balance REAL,
      type TEXT,
      type_detail TEXT,
      type_fill_source TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_tab_id ON transactions(tab_id);
  `)
}

initSchema()

module.exports = db
