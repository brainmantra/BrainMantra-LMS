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

    const { rows } = await pool.query(
      `SELECT * FROM teachers WHERE email = $1 AND is_active = TRUE`,
      [email]
    )
    const teacher = rows[0]
    if (!teacher || !teacher.is_active) {
      await logActivity({ userType: 'teacher', userLabel: email, action: 'login_fail', req, metadata: { reason: !teacher ? 'not_found' : 'inactive' } })
      return res.status(401).json({ message: 'Invalid credentials or inactive account.' })
    }

    const valid = await bcrypt.compare(password, teacher.password_hash)
    if (!valid) {
      await logActivity({ userType: 'teacher', userLabel: email, action: 'login_fail', req, metadata: { reason: 'wrong_password' } })
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    const token = signTeacherToken(teacher)
    await logActivity({ userType: 'teacher', userId: teacher.id, userLabel: email, action: 'login_success', req })
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
              MAX(dr.completed_at) AS last_active,
              ARRAY_REMOVE(ARRAY_AGG(CASE WHEN dr.completed THEN dr.day_number END), NULL) AS completed_days
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
      l1: "SELECT 'l1' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l1",
      l2: "SELECT 'l2' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l2",
      l3: "SELECT 'l3' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l3",
      l4: "SELECT 'l4' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l4",
      l5: "SELECT 'l5' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l5",
      l6: "SELECT 'l6' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l6",
      l7: "SELECT 'l7' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l7",
      l8: "SELECT 'l8' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_l8",
      alumni: "SELECT 'alumni' as level, id, student_id, day_number, section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, answered_at FROM responses_alumni"
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

export default router
