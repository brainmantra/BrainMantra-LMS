/**
 * routes/teachers.js — Teacher portal API
 */
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../db.js'
import { logActivity } from '../utils/logger.js'
import { signTeacherToken, requireTeacher } from '../middleware/auth.js'

const router = Router()

// ── POST /api/teachers/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Email and password required.' })

    const cleanEmail = String(email).trim().toLowerCase()
    const { rows } = await pool.query(
      `SELECT * FROM teachers WHERE LOWER(TRIM(email)) = $1 AND is_active = TRUE`,
      [cleanEmail]
    )
    const teacher = rows[0]
    if (!teacher || !teacher.is_active) {
      await logActivity({ userType: 'teacher', userLabel: cleanEmail, action: 'login_fail', req, metadata: { reason: !teacher ? 'not_found' : 'inactive' } })
      return res.status(401).json({ message: 'Invalid credentials or inactive account.' })
    }

    const valid = await bcrypt.compare(password, teacher.password_hash)
    if (!valid) {
      await logActivity({ userType: 'teacher', userLabel: cleanEmail, action: 'login_fail', req, metadata: { reason: 'wrong_password' } })
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    const token = signTeacherToken(teacher)
    await logActivity({ userType: 'teacher', userId: teacher.id, userLabel: cleanEmail, action: 'login_success', req })
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
    const { level, day_number, section = 'teacher_day', question, answer, format_example } = req.body
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
      `INSERT INTO teacher_questions (level, day_number, section, question, answer, format_example, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (level, day_number, section)
       DO UPDATE SET question = EXCLUDED.question, answer = EXCLUDED.answer,
                     format_example = EXCLUDED.format_example,
                     submitted_by = EXCLUDED.submitted_by, updated_at = NOW()
       RETURNING *`,
      [level, day_number, section, question, answer, format_example || null, teacherId]
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

// ── DELETE /api/teachers/questions — delete a teacher question ─────────────
router.delete('/questions', requireTeacher, async (req, res) => {
  try {
    const { level, day_number, section } = req.query
    const teacherId = req.teacher.id
    const levels = req.teacher.levels || []

    if (!levels.includes(level)) {
      return res.status(403).json({ message: 'Not assigned to this level.' })
    }

    await pool.query(
      `DELETE FROM teacher_questions WHERE level = $1 AND day_number = $2 AND section = $3`,
      [level, parseInt(day_number, 10), section]
    )

    // Activity log
    await pool.query(
      `INSERT INTO teacher_activity_log (teacher_id, action, level, day_number, section, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [teacherId, 'delete_question', level, parseInt(day_number, 10), section, section, null]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('[delete question]', err)
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
              MAX(dr.completed_at) AS last_active,
              ARRAY_REMOVE(ARRAY_AGG(CASE WHEN dr.completed THEN dr.day_number END ORDER BY dr.day_number DESC), NULL) AS completed_days,
              ARRAY_REMOVE(ARRAY_AGG(CASE WHEN dr.completed THEN dr.accuracy END ORDER BY dr.day_number DESC), NULL) AS recent_accuracies
       FROM students s
       LEFT JOIN day_records dr ON dr.student_id = s.id
       WHERE s.level = ANY($1)
       GROUP BY s.id
       ORDER BY s.level, s.name`,
      [levels]
    )
    
    // Calculate struggling state
    const now = new Date()
    const mapped = rows.map(r => {
      let isStruggling = false
      let strugglingReason = ''

      if (r.last_active) {
        const daysSince = (now - new Date(r.last_active)) / (1000 * 60 * 60 * 24)
        if (daysSince > 5) {
          isStruggling = true
          strugglingReason = `Inactive for ${Math.floor(daysSince)} days`
        }
      }

      if (!isStruggling && r.recent_accuracies && r.recent_accuracies.length > 0) {
        const recent3 = r.recent_accuracies.slice(0, 3)
        const avg = recent3.reduce((a, b) => a + parseFloat(b), 0) / recent3.length
        if (avg < 70) {
          isStruggling = true
          strugglingReason = `Recent accuracy is low (${Math.round(avg)}%)`
        }
      }

      return { ...r, is_struggling: isStruggling, struggling_reason: strugglingReason }
    })
    
    res.json(mapped)
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/teachers/students/:id — get student detailed days ────────────────
router.get('/students/:id', requireTeacher, async (req, res) => {
  try {
    const studentId = req.params.id
    const levels = req.teacher.levels || []
    if (!levels.length) return res.status(403).json({ message: 'No levels assigned.' })

    // Check if student exists and belongs to teacher's levels
    const { rows: stRows } = await pool.query(
      `SELECT id FROM students WHERE id = $1 AND level = ANY($2)`,
      [studentId, levels]
    )
    if (!stRows.length) return res.status(404).json({ message: 'Student not found or access denied.' })

    // Fetch all day records for the student
    const { rows } = await pool.query(
      `SELECT day_number, opened, opened_at, completed, completed_at,
              total_marks, accuracy, time_taken_seconds, xp_earned
       FROM day_records
       WHERE student_id = $1
       ORDER BY day_number`,
      [studentId]
    )

    res.json({ days: rows })
  } catch (err) {
    console.error('[teachers/student-details]', err)
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

// ── GET /api/teachers/responses ───────────────────────────────────────────────
router.get('/responses', requireTeacher, async (req, res) => {
  try {
    const { search = '', level = '', day_number = '', section_name = '', is_correct = '', sortBy = 'answered_at', sortOrder = 'DESC', limit = 100, page = 1, exportAll = 'false' } = req.query;

    const assignedLevels = req.teacher.levels || []
    if (!assignedLevels.length) {
      return res.json({ responses: [], totalCount: 0 })
    }

    // Filter to only allow levels assigned to the teacher
    const finalLevels = level && assignedLevels.includes(level) ? [level] : assignedLevels;

    // Construct UNION query only for levels assigned
    const tableMapping = {
      beginner: "SELECT 'beginner' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_beginner",
      l1: "SELECT 'l1' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l1",
      l2: "SELECT 'l2' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l2",
      l3: "SELECT 'l3' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l3",
      l4: "SELECT 'l4' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l4",
      l5: "SELECT 'l5' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l5",
      l6: "SELECT 'l6' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l6",
      l7: "SELECT 'l7' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l7",
      l8: "SELECT 'l8' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l8",
      alumni: "SELECT 'alumni' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_alumni",
      gm: "SELECT 'gm' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_gm"
    };

    const tableQueries = finalLevels.map(l => tableMapping[l]).filter(Boolean);
    if (!tableQueries.length) {
      return res.json({ responses: [], totalCount: 0 });
    }

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
    console.error('[teachers/responses]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/teachers/responses/:id/grade ─────────────────────────────────────
router.post('/responses/:id/grade', requireTeacher, async (req, res) => {
  try {
    const responseId = parseInt(req.params.id, 10)
    const { is_correct, level } = req.body

    const assignedLevels = req.teacher.levels || []
    if (!assignedLevels.includes(level)) {
      return res.status(403).json({ message: 'Not authorized for this student level.' })
    }

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

