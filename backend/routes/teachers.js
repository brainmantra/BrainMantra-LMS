/**
 * routes/teachers.js — Teacher portal API
 */
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../db.js'
import { signTeacherToken, requireTeacher } from '../middleware/auth.js'

const router = Router()

// ── POST /api/teachers/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Email and password required.' })

    const { rows } = await pool.query(
      `SELECT * FROM teachers WHERE email = $1 AND is_active = TRUE`,
      [email]
    )
    const teacher = rows[0]
    if (!teacher) return res.status(401).json({ message: 'Invalid credentials.' })

    const valid = await bcrypt.compare(password, teacher.password_hash)
    if (!valid) return res.status(401).json({ message: 'Invalid credentials.' })

    const token = signTeacherToken(teacher)
    res.json({
      token,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        assigned_levels: teacher.assigned_levels,
      },
    })
  } catch (err) {
    console.error('[teachers/login]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/teachers/me ──────────────────────────────────────────────────────
router.get('/me', requireTeacher, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, assigned_levels, is_active, created_at FROM teachers WHERE id = $1`,
      [req.teacher.id]
    )
    if (!rows[0]) return res.status(404).json({ message: 'Teacher not found.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/teachers/levels — assigned level cards with stats ────────────────
router.get('/levels', requireTeacher, async (req, res) => {
  try {
    const levels = req.teacher.levels || []
    if (!levels.length) return res.json([])

    const today = new Date().toISOString().slice(0, 10)
    const result = []

    for (const lvl of levels) {
      const [studentCount, activeToday, pendingFifthDays] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM students WHERE level = $1`, [lvl]),
        pool.query(
          `SELECT COUNT(DISTINCT s.id) FROM students s
           JOIN day_records dr ON dr.student_id = s.id
           WHERE s.level = $1 AND dr.opened_at::date = $2`,
          [lvl, today]
        ),
        pool.query(
          `SELECT d.day_number FROM (SELECT generate_series(5, 100, 5) AS day_number) d
           LEFT JOIN teacher_questions tq ON tq.level = $1 AND tq.day_number = d.day_number
           WHERE tq.id IS NULL ORDER BY d.day_number LIMIT 5`,
          [lvl]
        ),
      ])

      result.push({
        level: lvl,
        studentCount: parseInt(studentCount.rows[0].count),
        activeToday: parseInt(activeToday.rows[0].count),
        pendingFifthDays: pendingFifthDays.rows.map(r => r.day_number),
      })
    }

    res.json(result)
  } catch (err) {
    console.error('[teachers/levels]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/teachers/questions — list teacher-input sections ─────────────────
router.get('/questions', requireTeacher, async (req, res) => {
  try {
    const { level, day_number } = req.query
    const levels = req.teacher.levels || []

    if (level && !levels.includes(level)) {
      return res.status(403).json({ message: 'Not assigned to this level.' })
    }

    const filterLevels = level ? [level] : levels
    if (!filterLevels.length) return res.json([])

    const params = [filterLevels]
    let where = `WHERE level = ANY($1)`

    if (day_number) {
      params.push(parseInt(day_number))
      where += ` AND day_number = $${params.length}`
    }

    const { rows } = await pool.query(
      `SELECT tq.*, t.name as submitted_by_name
       FROM teacher_questions tq
       LEFT JOIN teachers t ON t.id = tq.submitted_by
       ${where} ORDER BY level, day_number`,
      params
    )

    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── POST /api/teachers/questions — save/upsert a teacher question ─────────────
router.post('/questions', requireTeacher, async (req, res) => {
  try {
    const { level, day_number, section = 'teacher_day', question, answer } = req.body
    const teacherId = req.teacher.id
    const levels = req.teacher.levels || []

    if (!levels.includes(level)) {
      return res.status(403).json({ message: 'Not assigned to this level.' })
    }
    if (!question || !answer) {
      return res.status(400).json({ message: 'Question and answer required.' })
    }

    // Fetch existing to log old value
    const { rows: existing } = await pool.query(
      `SELECT * FROM teacher_questions WHERE level = $1 AND day_number = $2 AND section = $3`,
      [level, day_number, section]
    )

    const { rows } = await pool.query(
      `INSERT INTO teacher_questions (level, day_number, section, question, answer, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (level, day_number, section)
       DO UPDATE SET question = EXCLUDED.question, answer = EXCLUDED.answer,
                     submitted_by = EXCLUDED.submitted_by, updated_at = NOW()
       RETURNING *`,
      [level, day_number, section, question, answer, teacherId]
    )

    // Activity log
    await pool.query(
      `INSERT INTO teacher_activity_log
       (teacher_id, action, level, day_number, section, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        teacherId,
        existing[0] ? 'edit_question' : 'create_question',
        level, day_number, section,
        existing[0] ? existing[0].question : null,
        question,
      ]
    )

    res.json(rows[0])
  } catch (err) {
    console.error('[teachers/questions POST]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/teachers/students — students in assigned levels ──────────────────
router.get('/students', requireTeacher, async (req, res) => {
  try {
    const levels = req.teacher.levels || []
    if (!levels.length) return res.json([])

    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.mobile, s.level, s.streak, s.xp_total,
              COUNT(CASE WHEN dr.completed THEN 1 END) AS days_completed,
              MAX(dr.completed_at) AS last_active
       FROM students s
       LEFT JOIN day_records dr ON dr.student_id = s.id
       WHERE s.level = ANY($1)
       GROUP BY s.id
       ORDER BY s.level, s.name`,
      [levels]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/teachers/fifth-days — upcoming 5th-day deadlines ────────────────
router.get('/fifth-days', requireTeacher, async (req, res) => {
  try {
    const levels = req.teacher.levels || []
    if (!levels.length) return res.json([])

    const { rows } = await pool.query(
      `SELECT d.day_number, lv.level,
              tq.question, tq.answer, tq.submitted_at,
              CASE WHEN tq.id IS NOT NULL THEN TRUE ELSE FALSE END as submitted
       FROM (SELECT generate_series(5, 100, 5) AS day_number) d
       CROSS JOIN (SELECT UNNEST($1::text[]) AS level) lv
       LEFT JOIN teacher_questions tq ON tq.level = lv.level AND tq.day_number = d.day_number
       ORDER BY lv.level, d.day_number`,
      [levels]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/teachers/activity — my own activity log ─────────────────────────
router.get('/activity', requireTeacher, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM teacher_activity_log
       WHERE teacher_id = $1 ORDER BY timestamp DESC LIMIT 200`,
      [req.teacher.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

export default router
