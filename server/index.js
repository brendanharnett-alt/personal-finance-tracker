const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

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

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
