# Personal Finance Tracker

React app for tracking personal finances: upload checking-account CSV, auto-categorize with an LLM using prior months as context, edit categories inline (Excel-style), filter columns, and view spend by category.

## Tech

- React (Vite), JavaScript, Tailwind CSS, PapaParse, AG Grid, Recharts.

## Run the app

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Optional: LLM categorization

To auto-categorize new transactions with an LLM (OpenAI):

1. Start the backend (from project root):

```bash
cd server
npm install
OPENAI_API_KEY=your-key npm start
```

2. In the app, use the Vite dev server (`npm run dev`). It proxies `/api` to the backend at http://localhost:3001.

Without the backend, uploads still work: rules from your past edits are applied, and rows that would need the LLM get category "Uncategorized" (with an error message).

## CSV format

- Columns: **Transaction Date**, **Transaction Description**, **Amount** (optional: **Category**).
- Dates are parsed and normalized to YYYY-MM-DD; amounts as numbers (negatives = expenses).

## Data

- Stored in `localStorage` under the key `finance_data`.
- Structure: `{ rules: { keyword: category }, months: { "YYYY-MM": [transactions] } }`.
- Editing a category in the grid updates the transaction and adds a rule so future uploads reuse that category without calling the LLM.
