import { Router } from 'express'
import pool from '../db.js'
import { getWeekStart, getWeekLabel } from '../utils/dateHelpers.js'

const router = Router()

/**
 * GET /api/leaderboard/weekly?level=beginner
 *
 * Returns the top students for the current Mon–Sun week,
 * ranked by average accuracy (desc) then average time (asc).
 * Only students who have at least one completed day this week
 * with an accuracy value are included.
 */
router.get('/weekly', async (req, res) => {
  try {
    const { level } = req.query
    const weekStart = getWeekStart()

    const levelClause = level ? `AND s.level = $2` : ''
    const params      = level ? [weekStart, level] : [weekStart]

    const { rows } = await pool.query(
      `SELECT
          s.id,
          s.name,
          s.level,
          COUNT(dr.id)::int                            AS days_this_week,
          ROUND(AVG(dr.accuracy)::numeric, 1)          AS accuracy,
          ROUND(AVG(dr.time_taken_seconds)::numeric, 0)::int AS avg_time
        FROM students s
        JOIN day_records dr
          ON dr.student_id = s.id
         AND dr.completed  = TRUE
         AND dr.completed_at >= $1
         AND dr.accuracy IS NOT NULL
        ${levelClause}
        GROUP BY s.id, s.name, s.level
        ORDER BY accuracy DESC, avg_time ASC NULLS LAST
        LIMIT 20`,
      params
    )

    res.json({
      leaders:   rows,
      weekLabel: getWeekLabel(),
    })
  } catch (err) {
    console.error('[leaderboard] Error:', err)
    res.status(500).json({ message: 'Server error fetching leaderboard.' })
  }
})

export default router
