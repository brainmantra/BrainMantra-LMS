import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pool from './db.js'
import studentsRouter    from './routes/students.js'
import leaderboardRouter from './routes/leaderboard.js'
import cronRouter        from './routes/cron.js'
import webhooksRouter    from './routes/webhooks.js'
import { startStreakCron } from './jobs/streakCron.js'

const app  = express()
const PORT = process.env.PORT || 5000

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map(s => s.trim())

app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json())

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'error', db: 'unreachable' })
  }
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
app.use((err, req, res, _next) => {
  console.error('[server] Unhandled error:', err)
  res.status(500).json({ message: 'Internal server error.' })
})

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await pool.query('SELECT 1')     // verify DB connection before accepting traffic
    console.log('[server] PostgreSQL connected')
    
    // Only run the background node-cron if we are not on Vercel (e.g. local or Render deployment)
    if (!process.env.VERCEL) {
      startStreakCron()
    }
    
    app.listen(PORT, () => {
      console.log(`[server] 100 Days of Abacus API listening on port ${PORT}`)
    })
  } catch (err) {
    console.error('[server] Could not connect to PostgreSQL:', err.message)
    console.error('         Check DATABASE_URL in api/.env')
    process.exit(1)
  }
}

if (!process.env.VERCEL) {
  start()
}

export default app