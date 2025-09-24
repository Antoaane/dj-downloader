import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import tidalRoutes from './routes/tidal.js'

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '2mb' }))

app.get('/health', (req, res) => res.json({ ok: true }))
app.use('/tidal', tidalRoutes)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend ready on http://localhost:${PORT}`))
