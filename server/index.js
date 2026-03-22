const express = require('express')
const cors = require('cors')

const dotenv = require('dotenv')
const path = require('path')
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const {
  getFinanceState,
  replaceFinanceState,
  migrateFromPayload,
  getAllTransactionsFlat,
  insertTransaction,
  deleteTransactionById,
} = require('./financeRepo')

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

app.post('/api/categorize', async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(503).send('LLM not configured: set OPENAI_API_KEY')
  }
  const { transactions = [], priorContext = '' } = req.body
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).send('transactions array required')
  }

  const lines = transactions.map((t) => `- "${t.description}" (amount: ${t.amount})`).join('\n')
  const systemPrompt = `You are a personal finance categorizer. Given a list of bank transaction descriptions and amounts, assign each to a single category. Use the prior categorizations below as guidance so your categories stay consistent. Return only a JSON array of category strings, one per transaction, in the same order. No explanation.

Prior categorizations (description -> category):
${priorContext || '(none yet)'}`

  const userPrompt = `Categorize these transactions. Return a JSON array of category strings only, e.g. ["Groceries","Transportation"]:\n\n${lines}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
    })
    if (!response.ok) {
      const err = await response.text()
      return res.status(502).send(err || response.statusText)
    }
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim() || '[]'
    let categories
    try {
      categories = JSON.parse(content)
    } catch {
      const match = content.match(/\[[\s\S]*\]/)
      categories = match ? JSON.parse(match[0]) : []
    }
    if (!Array.isArray(categories) || categories.length !== transactions.length) {
      return res.status(502).send('Invalid LLM response shape')
    }
    res.json({ categories })
  } catch (e) {
    res.status(500).send(e.message || 'LLM request failed')
  }
})

function escapeForPrompt(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
    .trim()
}

app.post('/api/type-fill', async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(503).send('LLM not configured: set OPENAI_API_KEY')
  }

  const { trainingPairs = [], types = [], targets = [] } = req.body ?? {}
  if (!Array.isArray(trainingPairs) || !Array.isArray(targets)) {
    return res.status(400).send('trainingPairs and targets arrays required')
  }
  if (trainingPairs.length === 0 || targets.length === 0) {
    return res.status(400).send('trainingPairs and targets must be non-empty')
  }

  const MAX_TRAINING_PAIRS = 400
  const cleanedPairs = trainingPairs
    .filter((p) => p && p.description && p.type)
    .map((p) => ({
      description: escapeForPrompt(p.description),
      type: escapeForPrompt(p.type),
    }))
    .filter((p) => p.description && p.type)

  const cleanedTargets = targets
    .filter((t) => t && t.description)
    .map((t) => ({ description: escapeForPrompt(t.description) }))
    .filter((t) => t.description)

  if (cleanedPairs.length === 0 || cleanedTargets.length === 0) {
    return res.status(400).send('No usable trainingPairs/targets after cleaning')
  }

  // Deduce fallback type (most frequent) from training data.
  const typeCounts = {}
  for (const p of cleanedPairs) typeCounts[p.type] = (typeCounts[p.type] ?? 0) + 1
  const fallbackType =
    (Array.isArray(types) && types.length ? types[0] : undefined) ??
    Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    'Uncategorized'

  const finalTypes =
    Array.isArray(types) && types.length ? types : Object.keys(typeCounts).slice(0, 200)

  const cappedPairs = cleanedPairs.slice(0, MAX_TRAINING_PAIRS)

  const lines = cappedPairs.map((p) => `- "${p.description}" -> "${p.type}"`).join('\n')
  const targetLines = cleanedTargets.map((t) => `- "${t.description}"`).join('\n')

  const systemPrompt = `You are a personal finance type-filler. Given historical examples mapping transaction descriptions to a Type, recommend the best Type for each target description.
Rules:
- Use exactly ONE Type per target.
- Choose ONLY from the provided Types list. If none fit, use the exact FallbackType.
- Return only a JSON array of strings, one per target, in the same order. No extra text or explanation.

Types: ${JSON.stringify(finalTypes)}
FallbackType: "${fallbackType}"`

  const userPrompt = `Historical examples (description -> type):
${lines}

Targets to fill:
${targetLines}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(502).send(err || response.statusText)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim() || '[]'
    let recommendations
    try {
      recommendations = JSON.parse(content)
    } catch {
      const match = content.match(/\[[\s\S]*\]/)
      recommendations = match ? JSON.parse(match[0]) : []
    }

    if (!Array.isArray(recommendations) || recommendations.length !== cleanedTargets.length) {
      return res.status(502).send('Invalid type-fill LLM response shape')
    }

    res.json({ types: recommendations })
  } catch (e) {
    res.status(500).send(e.message || 'LLM request failed')
  }
})

app.get('/api/finance', (req, res) => {
  try {
    res.json(getFinanceState())
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load finance data' })
  }
})

app.put('/api/finance', (req, res) => {
  try {
    replaceFinanceState(req.body)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to save finance data' })
  }
})

app.post('/api/migrate', (req, res) => {
  try {
    const result = migrateFromPayload(req.body)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message || 'Migration failed' })
  }
})

app.get('/api/transactions', (req, res) => {
  try {
    res.json(getAllTransactionsFlat())
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to list transactions' })
  }
})

app.post('/api/transactions', (req, res) => {
  try {
    const row = insertTransaction(req.body)
    res.status(201).json(row)
  } catch (e) {
    res.status(400).json({ error: e.message || 'Invalid transaction' })
  }
})

app.delete('/api/transactions/:id', (req, res) => {
  try {
    const n = deleteTransactionById(req.params.id)
    if (!n) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Delete failed' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
