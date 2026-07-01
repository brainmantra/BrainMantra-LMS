import cron from 'node-cron'
import pool from '../db.js'
import { recalculateStreak } from '../utils/streak.js'

/**
 * Runs every night at 00:05 server time.
 * Recalculates streaks for every active student so that any student
 * who missed "yesterday" has their streak broken automatically.
 */
export function startStreakCron() {
  cron.schedule('5 0 * * *', async () => {
    console.log('[cron] Running nightly streak recalculation…')
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
    } catch (err) {
      console.error('[cron] Streak recalculation failed:', err)
    }
  })
  console.log('[cron] Nightly streak job scheduled (00:05 daily)')
}
