import { Router } from 'express'
import pool from '../db.js'
import { recalculateStreak } from '../utils/streak.js'

const router = Router()

/**
 * GET /api/cron/streak
 * Webhook for Vercel Cron to trigger nightly streak recalculations.
 * Should be called once a day (e.g., at 00:05).
 */
router.get('/streak', async (req, res) => {
  // Optional: Verify Vercel Cron Secret here if needed
  // if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return res.status(401).json({ message: 'Unauthorized' })
  // }

  console.log('[cron] Starting streak recalculation via webhook...')
  try {
    const { rows: students } = await pool.query(
      'SELECT id, registration_date, streak FROM students'
    )
    
    let changed = 0
    for (const s of students) {
      const { streak } = await recalculateStreak(s.id, s.registration_date)
      if (streak !== s.streak) changed++
    }
    
    console.log(`[cron] Done. ${changed} streak(s) updated out of ${students.length} students.`)
    res.json({ message: 'Streak recalculation completed', studentsChecked: students.length, updated: changed })
  } catch (err) {
    console.error('[cron] Streak recalculation failed:', err)
    res.status(500).json({ message: 'Error recalculating streaks' })
  }
})

export default router
