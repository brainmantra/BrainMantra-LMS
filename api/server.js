import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import studentsRouter    from './routes/students.js'
import leaderboardRouter from './routes/leaderboard.js'
import cronRouter        from './routes/cron.js'
import webhooksRouter    from './routes/webhooks.js'

const app = express()

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map(s => s.trim())

app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json())

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/students',    studentsRouter)
app.use('/api/leaderboard', leaderboardRouter)
app.use('/api/cron',        cronRouter)
app.use('/api/webhooks',    webhooksRouter)

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route not found.' })
})

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[server] Unhandled error:', err)
  res.status(500).json({ message: 'Internal server error.' })
})

// ── Local dev only ─────────────────────────────────────────────────────────
// On Vercel, the file is imported as a serverless function — no .listen() needed.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000
  app.listen(PORT, () => {
    console.log(`[server] 100 Days of Abacus API listening on port ${PORT}`)
  })
}

export default app