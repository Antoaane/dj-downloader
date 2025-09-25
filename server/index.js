// server/index.js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import tidalRouter from './routes/tidal.js'

const app = express()

app.use(cors({ origin: true }))
app.use(express.json())

app.get('/health', (_req, res) => {
  console.log('[server] /health check')
  res.json({ ok: true })
})

app.use('/tidal', tidalRouter)

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`[server] listening on http://127.0.0.1:${PORT}`)
})
