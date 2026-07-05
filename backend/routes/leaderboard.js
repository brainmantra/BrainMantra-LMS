/**
 * routes/leaderboard.js — Weekly leaderboard (resets every Monday 00:00)
 */
import { Router } from 'express'
import pool from '../db.js'

const router = Router()

// ── GET /api/leaderboard/weekly?level=l3 ────────────────────────────────────────────
router.get('/weekly', async (req, res) => {
  try {
    const { level } = req.query

    // Calculate current Monday 00:00
    const now = new Date()
    const day = now.getDay() // 0=Sun, 1=Mon...
    const daysSinceMon = (day === 0 ? 6 : day - 1)
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - daysSinceMon)
    weekStart.setHours(0, 0, 0, 0)

    const params = [weekStart.toISOString()]
    let levelFilter = ''
    if (level) {
      params.push(level)
      levelFilter = `AND s.level = $${params.length}`
    }

    const { rows } = await pool.query(
      `SELECT
         s.id,
         s.name,
         s.level,
         s.xp_total,
         s.streak,
         COUNT(CASE WHEN dr.completed AND dr.completed_at >= $1 THEN 1 END) AS days_this_week,
         COALESCE(AVG(CASE WHEN dr.completed AND dr.completed_at >= $1 THEN dr.accuracy END), 0) AS weekly_accuracy,
         COALESCE(SUM(CASE WHEN dr.completed AND dr.completed_at >= $1 THEN dr.xp_earned END), 0) AS weekly_xp,
         COALESCE(AVG(
           CASE WHEN dr.completed AND dr.completed_at >= $1 AND dr.time_taken_seconds > 0
           THEN dr.time_taken_seconds::float / NULLIF(dr.total_marks / 10, 0)
           END
         ), 999) AS avg_time_per_question
       FROM students s
       LEFT JOIN day_records dr ON dr.student_id = s.id
       WHERE 1=1 ${levelFilter}
       GROUP BY s.id
       ORDER BY weekly_accuracy DESC, avg_time_per_question ASC`,
      params
    )

    // Add rank
    const ranked = rows.map((r, i) => ({
      ...r,
      rank: i + 1,
      weekly_accuracy: parseFloat(parseFloat(r.weekly_accuracy).toFixed(1)),
      avg_time_per_question: parseFloat(parseFloat(r.avg_time_per_question).toFixed(1)),
      weekly_xp: parseInt(r.weekly_xp),
      days_this_week: parseInt(r.days_this_week),
    }))

    res.json({
      weekStart: weekStart.toISOString(),
      leaderboard: ranked,
      top3: ranked.slice(0, 3),
    })
  } catch (err) {
    console.error('[leaderboard]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

export default router
