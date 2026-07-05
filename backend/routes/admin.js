/**
 * routes/admin.js — Full admin API (JWT-protected)
 */
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../db.js'
import { logActivity } from '../utils/logger.js'
import { signAdminToken, requireAdmin } from '../middleware/auth.js'

const router = Router()

// ── POST /api/admin/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required.' })
    }

    const { rows } = await pool.query('SELECT * FROM admin WHERE email = $1', [email])
    const admin = rows[0]
    if (!admin) {
      await logActivity({ userType: 'admin', userLabel: email, action: 'login_fail', req, metadata: { reason: 'not_found' } })
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    const valid = await bcrypt.compare(password, admin.password_hash)
    if (!valid) {
      await logActivity({ userType: 'admin', userLabel: email, action: 'login_fail', req, metadata: { reason: 'wrong_password' } })
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    const token = signAdminToken(admin)
    await logActivity({ userType: 'admin', userId: admin.id, userLabel: email, action: 'login_success', req })
    res.json({ token, admin: { id: admin.id, email: admin.email } })
  } catch (err) {
    console.error('[admin/login]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    const [totalStudents, activeToday, completedToday, xpToday, pendingTeacher] = await Promise.all([
      // Total students per level
      pool.query(`SELECT level, COUNT(*) as count FROM students GROUP BY level ORDER BY level`),

      // Active students today (opened a paper today)
      pool.query(`SELECT COUNT(DISTINCT student_id) as count FROM day_records WHERE opened_at::date = $1`, [today]),

      // Completed today
      pool.query(`SELECT COUNT(*) as count FROM day_records WHERE completed = TRUE AND completed_at::date = $1`, [today]),

      // XP distributed today
      pool.query(`SELECT COALESCE(SUM(xp_earned), 0) as total FROM day_records WHERE completed_at::date = $1`, [today]),

      // Pending teacher-day questions (5th days with no submission in next 10 days)
      pool.query(`
        SELECT tq.level, d.day_number
        FROM (
          SELECT generate_series(5, 100, 5) AS day_number
        ) d
        CROSS JOIN (SELECT DISTINCT level FROM students) lv
        LEFT JOIN teacher_questions tq ON tq.level = lv.level AND tq.day_number = d.day_number
        WHERE tq.id IS NULL
        ORDER BY d.day_number
        LIMIT 20
      `),
    ])

    res.json({
      totalStudents: totalStudents.rows,
      activeToday: parseInt(activeToday.rows[0]?.count || 0),
      completedToday: parseInt(completedToday.rows[0]?.count || 0),
      xpToday: parseInt(xpToday.rows[0]?.total || 0),
      pendingTeacherDays: pendingTeacher.rows,
    })
  } catch (err) {
    console.error('[admin/stats]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/admin/students ───────────────────────────────────────────────────
router.get('/students', requireAdmin, async (req, res) => {
  try {
    const { search = '', level = '', page = 1, limit = 50 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)

    let where = 'WHERE 1=1'
    const params = []

    if (search) {
      params.push(`%${search}%`)
      where += ` AND (s.name ILIKE $${params.length} OR s.mobile ILIKE $${params.length})`
    }
    if (level) {
      params.push(level)
      where += ` AND s.level = $${params.length}`
    }

    params.push(parseInt(limit), offset)

    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.mobile, s.level, s.registration_date,
              s.streak, s.longest_streak, s.xp_total,
              MAX(d.completed_at) AS last_active,
              COUNT(CASE WHEN d.completed THEN 1 END) AS days_completed
       FROM students s
       LEFT JOIN day_records d ON d.student_id = s.id
       ${where}
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    const countParams = params.slice(0, params.length - 2)
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM students s ${where}`,
      countParams
    )

    res.json({ students: rows, total: parseInt(countRows[0].count) })
  } catch (err) {
    console.error('[admin/students]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/admin/students/:id ───────────────────────────────────────────────
router.get('/students/:id', requireAdmin, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id)
    const { rows: student } = await pool.query('SELECT * FROM students WHERE id = $1', [studentId])
    if (!student[0]) return res.status(404).json({ message: 'Student not found.' })

    const { rows: days } = await pool.query(
      `SELECT * FROM day_records WHERE student_id = $1 ORDER BY day_number`,
      [studentId]
    )

    res.json({ student: student[0], days })
  } catch (err) {
    console.error('[admin/students/:id]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/admin/students/:id/day/:dayNum/responses ─────────────────────────
router.get('/students/:id/day/:dayNum/responses', requireAdmin, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id)
    const dayNum = parseInt(req.params.dayNum)

    const { rows: student } = await pool.query('SELECT level FROM students WHERE id = $1', [studentId])
    if (!student[0]) return res.status(404).json({ message: 'Student not found.' })

    const level = student[0].level
    const tableNum = level.replace('l', '')
    const tableName = `responses_l${tableNum}`

    const { rows } = await pool.query(
      `SELECT * FROM ${tableName}
       WHERE student_id = $1 AND day_number = $2
       ORDER BY section_name, id`,
      [studentId, dayNum]
    )

    res.json(rows)
  } catch (err) {
    console.error('[admin/student-responses]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/admin/teachers ───────────────────────────────────────────────────
router.get('/teachers', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, assigned_levels, is_active, created_at FROM teachers ORDER BY created_at DESC`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── POST /api/admin/teachers ──────────────────────────────────────────────────
router.post('/teachers', requireAdmin, async (req, res) => {
  try {
    const { name, email, password, assigned_levels = [] } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password required.' })
    }

    const hash = await bcrypt.hash(password, 12)
    const { rows } = await pool.query(
      `INSERT INTO teachers (name, email, password_hash, assigned_levels)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, assigned_levels, is_active, created_at`,
      [name, email, hash, assigned_levels]
    )

    // Log activity
    await pool.query(
      `INSERT INTO teacher_activity_log (teacher_id, action, new_value) VALUES (NULL, 'create_teacher', $1)`,
      [email]
    )

    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Email already exists.' })
    console.error('[admin/teachers POST]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── PUT /api/admin/teachers/:id ───────────────────────────────────────────────
router.put('/teachers/:id', requireAdmin, async (req, res) => {
  try {
    const { name, email, assigned_levels, is_active, password } = req.body
    const teacherId = parseInt(req.params.id)

    let updateFields = 'name = $1, email = $2, assigned_levels = $3, is_active = $4, updated_at = NOW()'
    let params = [name, email, assigned_levels, is_active, teacherId]

    if (password) {
      const hash = await bcrypt.hash(password, 12)
      updateFields += ', password_hash = $5'
      params = [name, email, assigned_levels, is_active, hash, teacherId]
      updateFields = updateFields.replace('$5', `$${params.length - 1}`)
    }

    const { rows } = await pool.query(
      `UPDATE teachers SET ${updateFields} WHERE id = $${params.length}
       RETURNING id, name, email, assigned_levels, is_active`,
      params
    )

    if (!rows[0]) return res.status(404).json({ message: 'Teacher not found.' })

    await pool.query(
      `INSERT INTO teacher_activity_log (teacher_id, action) VALUES ($1, 'teacher_updated')`,
      [teacherId]
    )

    res.json(rows[0])
  } catch (err) {
    console.error('[admin/teachers PUT]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── DELETE /api/admin/teachers/:id ────────────────────────────────────────────
router.delete('/teachers/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE teachers SET is_active = FALSE WHERE id = $1', [parseInt(req.params.id)])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/admin/question-bank ──────────────────────────────────────────────
router.get('/question-bank', requireAdmin, async (req, res) => {
  try {
    const { level, section, page = 1, limit = 50 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const params = []
    let where = 'WHERE 1=1'

    if (level) { params.push(level); where += ` AND level = $${params.length}` }
    if (section) { params.push(section); where += ` AND section = $${params.length}` }

    params.push(parseInt(limit), offset)

    const { rows } = await pool.query(
      `SELECT * FROM question_bank ${where} ORDER BY level, section, question_index
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── PUT /api/admin/question-bank/:id ─────────────────────────────────────────
router.put('/question-bank/:id', requireAdmin, async (req, res) => {
  try {
    const { answer, answer_text, addends, operand1, operator, operand2 } = req.body
    const { rows } = await pool.query(
      `UPDATE question_bank SET answer = $1, answer_text = $2, addends = $3,
       operand1 = $4, operator = $5, operand2 = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [answer, answer_text, addends ? JSON.stringify(addends) : null, operand1, operator, operand2, parseInt(req.params.id)]
    )
    if (!rows[0]) return res.status(404).json({ message: 'Question not found.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/admin/teacher-questions ─────────────────────────────────────────
router.get('/teacher-questions', requireAdmin, async (req, res) => {
  try {
    const { level, day_number } = req.query
    const params = []
    let where = 'WHERE 1=1'

    if (level) { params.push(level); where += ` AND tq.level = $${params.length}` }
    if (day_number) { params.push(parseInt(day_number)); where += ` AND tq.day_number = $${params.length}` }

    const { rows } = await pool.query(
      `SELECT tq.*, t.name as teacher_name
       FROM teacher_questions tq
       LEFT JOIN teachers t ON t.id = tq.submitted_by
       ${where} ORDER BY tq.level, tq.day_number`,
      params
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── PUT /api/admin/teacher-questions/:id ─────────────────────────────────────
router.put('/teacher-questions/:id', requireAdmin, async (req, res) => {
  try {
    const { question, answer } = req.body
    const { rows } = await pool.query(
      `UPDATE teacher_questions SET question = $1, answer = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [question, answer, parseInt(req.params.id)]
    )
    if (!rows[0]) return res.status(404).json({ message: 'Question not found.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/admin/performance ────────────────────────────────────────────────
router.get('/performance', requireAdmin, async (req, res) => {
  try {
    const [accuracyDist, completionRate, xpLeaderboard, levelComparison] = await Promise.all([
      // Accuracy distribution (buckets of 10%)
      pool.query(`
        SELECT
          FLOOR(accuracy / 10) * 10 AS bucket,
          COUNT(*) AS count
        FROM day_records
        WHERE accuracy IS NOT NULL
        GROUP BY bucket ORDER BY bucket
      `),

      // Completion rate per day (% of students who completed each day)
      pool.query(`
        SELECT
          dr.day_number,
          COUNT(CASE WHEN dr.completed THEN 1 END)::float / COUNT(DISTINCT s.id) * 100 AS completion_pct
        FROM students s
        LEFT JOIN day_records dr ON dr.student_id = s.id
        GROUP BY dr.day_number
        ORDER BY dr.day_number
      `),

      // Top 20 XP all time
      pool.query(`
        SELECT id, name, level, xp_total, streak
        FROM students ORDER BY xp_total DESC LIMIT 20
      `),

      // Average accuracy per level
      pool.query(`
        SELECT s.level, AVG(dr.accuracy) AS avg_accuracy, AVG(dr.time_taken_seconds) AS avg_time
        FROM students s
        JOIN day_records dr ON dr.student_id = s.id
        WHERE dr.completed = TRUE
        GROUP BY s.level ORDER BY s.level
      `),
    ])

    res.json({
      accuracyDistribution: accuracyDist.rows,
      completionRate: completionRate.rows,
      xpLeaderboard: xpLeaderboard.rows,
      levelComparison: levelComparison.rows,
    })
  } catch (err) {
    console.error('[admin/performance]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/admin/activity-log ───────────────────────────────────────────────
router.get('/activity-log', requireAdmin, async (req, res) => {
  try {
    const { teacher_id, level, from, to, page = 1, limit = 100 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const params = []
    let where = 'WHERE 1=1'

    if (teacher_id) { params.push(parseInt(teacher_id)); where += ` AND tal.teacher_id = $${params.length}` }
    if (level) { params.push(level); where += ` AND tal.level = $${params.length}` }
    if (from) { params.push(from); where += ` AND tal.timestamp >= $${params.length}` }
    if (to) { params.push(to); where += ` AND tal.timestamp <= $${params.length}` }

    params.push(parseInt(limit), offset)

    const { rows } = await pool.query(
      `SELECT tal.*, t.name as teacher_name
       FROM teacher_activity_log tal
       LEFT JOIN teachers t ON t.id = tal.teacher_id
       ${where} ORDER BY tal.timestamp DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/admin/questions/:level/:day ──────────────────────────────────────
router.get('/questions/:level/:day', requireAdmin, async (req, res) => {
  try {
    const { level, day } = req.params
    const { rows } = await pool.query(
      `SELECT id, question_text, expected_answer, format_example, question_type 
       FROM questions WHERE level = $1 AND day_number = $2 ORDER BY id ASC`,
      [level, parseInt(day, 10)]
    )
    res.json(rows)
  } catch (err) {
    console.error('[admin/questions GET]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── PUT /api/admin/questions/:level/:day ──────────────────────────────────────
router.put('/questions/:level/:day', requireAdmin, async (req, res) => {
  const client = await pool.connect()
  try {
    const { level, day } = req.params
    const { questions } = req.body // Array of questions

    await client.query('BEGIN')

    // Delete existing questions for this day
    await client.query(
      `DELETE FROM questions WHERE level = $1 AND day_number = $2`,
      [level, parseInt(day, 10)]
    )

    // Insert new questions
    if (questions && questions.length > 0) {
      for (const q of questions) {
        await client.query(
          `INSERT INTO questions (level, day_number, question_text, expected_answer, format_example, question_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [level, parseInt(day, 10), q.question_text, q.expected_answer, q.format_example || null, q.question_type || 'math']
        )
      }
    }

    await client.query('COMMIT')
    res.json({ success: true, count: questions ? questions.length : 0 })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[admin/questions PUT]', err)
    res.status(500).json({ message: 'Server error.' })
  } finally {
    client.release()
  }
})

// ── GET /api/admin/login-logs ──────────────────────────────────────────────────
router.get('/login-logs', requireAdmin, async (req, res) => {
  try {
    const { userType, limit = 100 } = req.query

    let query = `
      SELECT id, user_type, user_id, user_label, action, ip_address, metadata, created_at
      FROM activity_logs
    `
    const params = []

    if (userType && userType !== 'all') {
      params.push(userType)
      query += ` WHERE user_type = $1 `
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`
    params.push(parseInt(limit, 10))

    const { rows } = await pool.query(query, params)
    res.json({ logs: rows })
  } catch (err) {
    console.error('[admin/login-logs]', err)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
