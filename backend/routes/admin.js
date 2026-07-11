/**
 * routes/admin.js — Full admin API (JWT-protected)
 */
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../db.js'
import { logActivity } from '../utils/logger.js'
import { signAdminToken, requireAdmin } from '../middleware/auth.js'
import { fetchRegistrationSheet, normaliseLevel } from '../utils/googleSheet.js'

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
      where += ` AND (s.name ILIKE $${params.length} OR s.mobile ILIKE $${params.length} OR s.username ILIKE $${params.length})`
    }
    if (level) {
      const levelMap = {
        l1: ['l1', 'beginner', 'level 1', 'level-1'],
        l2: ['l2', 'elementary', 'level 2', 'level-2'],
        l3: ['l3', 'intermediate', 'level 3', 'level-3'],
        l4: ['l4', 'advanced', 'level 4', 'level-4'],
        l5: ['l5', 'expert', 'level 5', 'level-5'],
        l6: ['l6', 'level 6', 'level-6'],
        l7: ['l7', 'level 7', 'level-7'],
        l8: ['l8', 'level 8', 'level-8']
      }
      const allowed = levelMap[level] || [level]
      params.push(allowed)
      where += ` AND (LOWER(s.level) = ANY($${params.length}))`
    }

    params.push(parseInt(limit), offset)

    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.mobile, s.level, s.registration_date,
              s.streak, s.longest_streak, s.xp_total, s.username, s.plain_password,
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

// ── POST /api/admin/students/sync ───────────────────────────────────────────────
router.post('/students/sync', requireAdmin, async (req, res) => {
  try {
    const sheetRows = await fetchRegistrationSheet()
    
    // Deduplicate sheet rows by mobile (keep the first entry)
    const seenMobiles = new Set()
    const uniqueSheetRows = []
    for (const row of sheetRows) {
      if (!seenMobiles.has(row.mobile)) {
        seenMobiles.add(row.mobile)
        uniqueSheetRows.push(row)
      }
    }

    const { rows: dbStudents } = await pool.query('SELECT id, name, mobile, level FROM students')
    
    // Create lookup maps
    const dbStudentsByMobile = new Map(dbStudents.map(s => [s.mobile, s]))
    const sheetMobiles = new Set(uniqueSheetRows.map(r => r.mobile))
    
    let addedCount = 0
    let updatedCount = 0
    let deletedCount = 0
    let credentialsGenerated = 0

    // Helper to generate credentials — login ID is derived from the student's name
    const generateCredentials = async (name, mobile) => {
      const base = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `student_${mobile.slice(-4)}`
      // Check uniqueness; append suffix if needed
      let username = base
      let suffix = 1
      while (true) {
        const { rows: clash } = await pool.query('SELECT id FROM students WHERE username = $1', [username])
        if (clash.length === 0) break
        username = `${base}_${suffix++}`
      }
      const plain_password = Math.random().toString(36).slice(-6)
      return { username, plain_password }
    }

    // 1. Process sheet rows: Update existing, insert new
    for (const st of uniqueSheetRows) {
      const levelId = normaliseLevel(st.level) || 'l1'
      const existing = dbStudentsByMobile.get(st.mobile)
      
      if (existing) {
        // If name or level changed, update only these
        if (existing.level !== levelId || existing.name !== st.name) {
          await pool.query(
            'UPDATE students SET name = $1, level = $2, updated_at = NOW() WHERE id = $3',
            [st.name, levelId, existing.id]
          )
          updatedCount++
        }
      } else {
        // Insert new student
        const { username, plain_password } = await generateCredentials(st.name, st.mobile)
        const hash = await bcrypt.hash(plain_password, 12)
        
        await pool.query(
          `INSERT INTO students (name, mobile, level, username, password_hash, plain_password, registration_date)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [st.name, st.mobile, levelId, username, hash, plain_password]
        )
        addedCount++
      }
    }

    // 2. Assign credentials to existing students missing them
    const { rows: missingCredentials } = await pool.query('SELECT id, mobile, name FROM students WHERE username IS NULL')
    for (const st of missingCredentials) {
      const { username, plain_password } = await generateCredentials(st.name, st.mobile)
      const hash = await bcrypt.hash(plain_password, 12)
      await pool.query(
        'UPDATE students SET username = $1, password_hash = $2, plain_password = $3 WHERE id = $4',
        [username, hash, plain_password, st.id]
      )
      credentialsGenerated++
    }

    // 3. Delete students who are in the DB but NOT in the sheet
    for (const dbSt of dbStudents) {
      if (!sheetMobiles.has(dbSt.mobile)) {
        await pool.query('DELETE FROM students WHERE id = $1', [dbSt.id])
        deletedCount++
      }
    }

    res.json({ 
      success: true, 
      addedCount, 
      updatedCount, 
      deletedCount, 
      credentialsGenerated, 
      totalSynced: addedCount + credentialsGenerated 
    })
  } catch (err) {
    console.error('[admin/students/sync]', err)
    res.status(500).json({ message: 'Server error during sync.' })
  }
})

// ── POST /api/admin/students ──────────────────────────────────────────────────
router.post('/students', requireAdmin, async (req, res) => {
  try {
    const { name, mobile, level, username, password } = req.body

    if (!name || !mobile || !level || !username || !password) {
      return res.status(400).json({ message: 'All fields (Name, Mobile, Level, Login ID, Password) are required.' })
    }

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: 'Mobile number must be exactly 10 digits.' })
    }

    const cleanUsername = String(username).trim().toLowerCase()

    // Check if name+mobile already exists
    const { rows: existingStudent } = await pool.query(
      'SELECT id FROM students WHERE LOWER(name) = $1 AND mobile = $2', 
      [name.trim().toLowerCase(), mobile]
    )
    if (existingStudent.length > 0) {
      return res.status(409).json({ message: 'A student with this name and mobile number already exists.' })
    }

    // Check if username already exists
    const { rows: existingUser } = await pool.query('SELECT id FROM students WHERE username = $1', [cleanUsername])
    if (existingUser.length > 0) {
      return res.status(409).json({ message: 'This Login ID (username) is already taken.' })
    }

    // Hash the password
    const hash = await bcrypt.hash(password, 12)

    // Insert student
    const { rows: created } = await pool.query(
      `INSERT INTO students (name, mobile, level, username, password_hash, plain_password, registration_date)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [name.trim(), mobile.trim(), level, cleanUsername, hash, password]
    )

    delete created[0].password_hash

    res.status(201).json({ success: true, student: created[0], message: 'Student created successfully.' })
  } catch (err) {
    console.error('[admin/students/create]', err)
    res.status(500).json({ message: 'Server error creating student.' })
  }
})

// ── POST /api/admin/students/:id/credentials ──────────────────────────────────
router.post('/students/:id/credentials', requireAdmin, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10)
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' })
    }

    const cleanUsername = String(username).trim().toLowerCase()

    // Check if username is already taken by another student
    const { rows: existing } = await pool.query(
      'SELECT id FROM students WHERE username = $1 AND id != $2',
      [cleanUsername, studentId]
    )
    if (existing.length > 0) {
      return res.status(409).json({ message: 'This Login ID (username) is already taken.' })
    }

    // Hash the password
    const hash = await bcrypt.hash(password, 12)

    await pool.query(
      'UPDATE students SET username = $1, password_hash = $2, plain_password = $3, updated_at = NOW() WHERE id = $4',
      [cleanUsername, hash, password, studentId]
    )

    res.json({ success: true, message: 'Student credentials saved successfully.' })
  } catch (err) {
    console.error('[admin/students/:id/credentials]', err)
    res.status(500).json({ message: 'Server error saving credentials.' })
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

    // Remove password_hash from response for security
    delete student[0].password_hash

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
    let tableName = `responses_l${level.replace('l', '')}`
    if (level === 'alumni') tableName = 'responses_alumni'
    else if (level === 'beginner') tableName = 'responses_beginner'
    else if (level === 'gm') tableName = 'responses_gm'

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

// ── POST /api/admin/teacher-questions ─────────────────────────────────────────
router.post('/teacher-questions', requireAdmin, async (req, res) => {
  try {
    const { level, day_number, section = 'teacher_day', question, answer, format_example } = req.body
    if (!question || !answer) {
      return res.status(400).json({ message: 'Question and answer required.' })
    }

    const { rows } = await pool.query(
      `INSERT INTO teacher_questions (level, day_number, section, question, answer, format_example, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)
       ON CONFLICT (level, day_number, section)
       DO UPDATE SET question = EXCLUDED.question, answer = EXCLUDED.answer,
                     format_example = EXCLUDED.format_example, updated_at = NOW()
       RETURNING *`,
      [level, day_number, section, question, answer, format_example || null]
    )
    res.json(rows[0])
  } catch (err) {
    console.error('[admin/teacher-questions POST]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── DELETE /api/admin/teacher-questions — delete a teacher question ─────────────
router.delete('/teacher-questions', requireAdmin, async (req, res) => {
  try {
    const { level, day_number, section } = req.query
    await pool.query(
      `DELETE FROM teacher_questions WHERE level = $1 AND day_number = $2 AND section = $3`,
      [level, parseInt(day_number, 10), section]
    )
    res.json({ success: true })
  } catch (err) {
    console.error('[delete question admin]', err)
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

// ── GET /api/admin/responses ──────────────────────────────────────────────────
router.get('/responses', requireAdmin, async (req, res) => {
  try {
    const { search = '', level = '', day_number = '', section_name = '', is_correct = '', sortBy = 'answered_at', sortOrder = 'DESC', limit = 100, page = 1, exportAll = 'false' } = req.query;

    const tableQueries = [
      "SELECT 'beginner' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_beginner",
      "SELECT 'l1' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l1",
      "SELECT 'l2' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l2",
      "SELECT 'l3' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l3",
      "SELECT 'l4' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l4",
      "SELECT 'l5' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l5",
      "SELECT 'l6' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l6",
      "SELECT 'l7' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l7",
      "SELECT 'l8' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l8",
      "SELECT 'alumni' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_alumni",
      "SELECT 'gm' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_gm"
    ];

    const unionSubquery = tableQueries.join('\nUNION ALL\n');

    let countQuery = `
      SELECT COUNT(*) 
      FROM (${unionSubquery}) r
      JOIN students s ON s.id = r.student_id
      WHERE 1=1
    `;

    let dataQuery = `
      SELECT r.id, r.level, r.student_id, s.name as student_name, s.mobile as student_mobile,
             r.day_number, r.section_name, r.question_snapshot, r.correct_answer,
             r.student_answer, r.is_correct, r.time_taken_seconds, r.answered_at
      FROM (${unionSubquery}) r
      JOIN students s ON s.id = r.student_id
      WHERE 1=1
    `;

    const params = [];
    let filterIndex = 1;

    // Filters
    let filters = '';
    if (search) {
      params.push(`%${search}%`);
      filters += ` AND (s.name ILIKE $${filterIndex} OR s.mobile ILIKE $${filterIndex})`;
      filterIndex++;
    }
    if (level) {
      params.push(level);
      filters += ` AND r.level = $${filterIndex}`;
      filterIndex++;
    }
    if (day_number) {
      params.push(parseInt(day_number, 10));
      filters += ` AND r.day_number = $${filterIndex}`;
      filterIndex++;
    }
    if (section_name) {
      params.push(section_name);
      filters += ` AND r.section_name = $${filterIndex}`;
      filterIndex++;
    }
    if (is_correct !== '') {
      params.push(is_correct === 'true');
      filters += ` AND r.is_correct = $${filterIndex}`;
      filterIndex++;
    }

    countQuery += filters;
    dataQuery += filters;

    // Sorting
    const allowedSortFields = ['answered_at', 'student_name', 'day_number', 'is_correct', 'time_taken_seconds'];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'answered_at';
    const orderDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    if (orderField === 'student_name') {
      dataQuery += ` ORDER BY s.name ${orderDir}`;
    } else {
      dataQuery += ` ORDER BY r.${orderField} ${orderDir}`;
    }

    let resultRows;
    let totalCount = 0;

    if (exportAll === 'true') {
      const { rows } = await pool.query(dataQuery, params);
      resultRows = rows;
      totalCount = rows.length;
    } else {
      // Pagination
      const countRes = await pool.query(countQuery, params);
      totalCount = parseInt(countRes.rows[0].count, 10);

      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      dataQuery += ` LIMIT $${filterIndex} OFFSET $${filterIndex + 1}`;
      params.push(parseInt(limit, 10), offset);

      const { rows } = await pool.query(dataQuery, params);
      resultRows = rows;
    }

    res.json({
      responses: resultRows,
      totalCount,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });
  } catch (err) {
    console.error('[admin/responses]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/admin/responses/:id/grade ─────────────────────────────────────
router.post('/responses/:id/grade', requireAdmin, async (req, res) => {
  try {
    const responseId = parseInt(req.params.id, 10)
    const { is_correct, level } = req.body

    let tableName = `responses_l${level.replace('l', '')}`
    if (level === 'alumni') tableName = 'responses_alumni'
    else if (level === 'beginner') tableName = 'responses_beginner'
    else if (level === 'gm') tableName = 'responses_gm'

    // 1. Fetch current response
    const { rows: respRows } = await pool.query(
      `SELECT * FROM ${tableName} WHERE id = $1`,
      [responseId]
    )
    if (!respRows.length) {
      return res.status(404).json({ message: 'Response not found.' })
    }
    const resp = respRows[0]

    // Determine the XP change:
    const wasCorrect = resp.is_correct === true
    const isNowCorrect = is_correct === true
    const newXpEarned = isNowCorrect ? 10 : 0
    const xpDifference = newXpEarned - (resp.xp_earned || 0)

    // 2. Update response row
    await pool.query(
      `UPDATE ${tableName} 
       SET is_correct = $1, xp_earned = $2 
       WHERE id = $3`,
      [is_correct, newXpEarned, responseId]
    )

    // 3. Recalculate day record and student total
    const { student_id, day_number } = resp

    // Recalculate day record's section_data, marks, accuracy, etc.
    const { rows: allRespRows } = await pool.query(
      `SELECT * FROM ${tableName} WHERE student_id = $1 AND day_number = $2`,
      [student_id, day_number]
    )

    // Group all responses of this day by section
    const bySection = {}
    allRespRows.forEach(r => {
      if (!bySection[r.section_name]) bySection[r.section_name] = []
      bySection[r.section_name].push(r)
    })

    const { rows: dayRows } = await pool.query(
      `SELECT section_data, xp_earned FROM day_records WHERE student_id = $1 AND day_number = $2`,
      [student_id, day_number]
    )

    if (dayRows.length) {
      const sectionData = dayRows[0].section_data || {}

      let totalMarks = 0
      let totalXp = 0
      let totalCorrect = 0
      let totalQs = 0

      // Update each section in sectionData
      for (const secName of Object.keys(bySection)) {
        const secResps = bySection[secName]
        const secCorrect = secResps.filter(r => r.is_correct === true).length
        const secQs = secResps.length

        if (sectionData[secName]) {
          sectionData[secName].correct = secCorrect
          sectionData[secName].marks = secCorrect * 10
          sectionData[secName].xpEarned = secCorrect * 10
        }
      }

      // Recalculate paper aggregates from all sections
      const sections = Object.keys(sectionData)
      for (const sec of sections) {
        const sd = sectionData[sec] || {}
        totalMarks += sd.marks || 0
        totalXp += sd.xpEarned || 0
        totalCorrect += sd.correct || 0
        totalQs += sd.questionCount || 0
      }

      const newAccuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0

      // Update day_records
      await pool.query(
        `UPDATE day_records
         SET total_marks = $1, accuracy = $2, xp_earned = xp_earned + $3, answers = $4, section_data = $5, updated_at = NOW()
         WHERE student_id = $6 AND day_number = $7`,
        [totalMarks, newAccuracy, xpDifference, JSON.stringify(allRespRows), JSON.stringify(sectionData), student_id, day_number]
      )

      // Update student cumulative XP
      await pool.query(
        `UPDATE students 
         SET xp_total = xp_total + $1, updated_at = NOW() 
         WHERE id = $2`,
        [xpDifference, student_id]
      )
    }

    res.json({ success: true })
  } catch (err) {
    console.error('[grade_response]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

export default router

