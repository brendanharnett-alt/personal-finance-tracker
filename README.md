# Personal Finance Tracker

React app for tracking personal finances: upload checking-account CSV, auto-categorize with an LLM using prior months as context, edit categories inline (Excel-style), filter columns, and view spend by category.

## Tech

- React (Vite), JavaScript, Tailwind CSS, PapaParse, AG Grid, Recharts.
- Node.js + Express + SQLite (`better-sqlite3`) for persistence and LLM routes.

## Run the app

```bash
npm install
```

**Terminal 1 — backend** (required for saving data and LLM features):

```bash
node server/index.js
```

Runs at http://localhost:3001 and creates `server/finance.db` on first use.

**Terminal 2 — frontend:**

```bash
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` to the backend.

## Optional: LLM categorization

1. Copy `.env` in the project root and set `OPENAI_API_KEY=your-key` (the server loads `../.env` from `server/index.js`).
2. With the backend running, uploads can call `/api/categorize` for uncategorized rows.

Without the backend, the UI loads empty data; uploads and edits need the API.

## Data storage (SQLite)

- Database file: **`server/finance.db`** (gitignored).
- The app reads/writes via **`GET /api/finance`** and **`PUT /api/finance`** with the shape `{ rules, tabs, tabOrder }`.
- The selected tab id is still stored in **localStorage** only (`finance_selected_tab_id`) for refresh restore.

### One-time migration from old localStorage

If you previously used the app with data under `localStorage` key `finance_data`:

1. Start the backend.
2. Send the same JSON to the migrate endpoint (e.g. from DevTools → Application → Local Storage, copy the value):

```bash
curl -X POST http://localhost:3001/api/migrate -H "Content-Type: application/json" -d @backup.json
```

Or from the browser console (with the app open on the dev server):

```js
fetch('/api/migrate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: localStorage.getItem('finance_data') || '{}',
}).then((r) => r.json()).then(console.log)
```

`POST /api/migrate` only imports when the database has **no tabs yet**. If you already have data, use `PUT /api/finance` with a full JSON blob, or remove `server/finance.db` and migrate again (destructive).

## CSV format

- Columns: **Transaction Date**, **Transaction Description**, **Amount** (optional: **Category**).
- Dates are parsed and normalized to YYYY-MM-DD; amounts as numbers (negatives = expenses).

## Data model

- `{ rules: { keyword: category }, tabs: { tabId: { label, transactions: [...] } }, tabOrder: string[] }`.
- Transactions may include optional fields: `balance`, `type`, `typeDetail`, `typeFillSource`, and `id` (from SQLite after load).
