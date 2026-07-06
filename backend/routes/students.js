/**
 * routes/students.js — Student API (section-based paper flow)
 */
import { Router } from 'express'
import pool from '../db.js'
import { getChallengeDay } from '../utils/dateHelpers.js'
import { recalculateStreak } from '../utils/streak.js'
import { findInSheet, normaliseLevel } from '../utils/googleSheet.js'
import {
  selectQuestionsForDay,
  getTeacherQuestion,
  getSectionsForLevel,
  isTeacherDay,
  SECTION_LABELS,
  TEACHER_INPUT_SECTIONS,
} from '../utils/questionSelector.js'
import { logActivity } from '../utils/logger.js'

const router = Router()

// ── Helper ────────────────────────────────────────────────────────────────────
async function getStudentById(id) {
  const { rows } = await pool.query('SELECT * FROM students WHERE id = $1', [id])
  return rows[0] ?? null
}

function normalizeStudentLevel(raw) {
  // Accepts 'l1'..'l8', '1'..'8', 'beginner' etc.
  if (!raw) return null
  if (/^l[1-8]$/i.test(raw)) return raw.toLowerCase()
  if (/^[1-8]$/.test(raw)) return `l${raw}`
  const map = { beginner: 'l1', elementary: 'l2', intermediate: 'l3', advanced: 'l4', expert: 'l5' }
  return map[raw.toLowerCase()] || null
}

// ── POST /api/students/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { mobile } = req.body
    if (!/^\d{10}$/.test(mobile ?? '')) {
      return res.status(400).json({ message: 'A valid 10-digit mobile number is required.' })
    }

    // Fast path — already in DB
    const { rows: existing } = await pool.query('SELECT * FROM students WHERE mobile = $1', [mobile])
    if (existing.length > 0) {
      await logActivity({ userType: 'student', userId: existing[0].id, userLabel: existing[0].name, action: 'login_success', req })
      return res.json({ student: existing[0] })
    }

    // Check Google Sheet for enrollment
    let sheetRow
    try {
      sheetRow = await findInSheet(mobile)
    } catch (sheetErr) {
      console.error('[login] Sheet lookup failed:', sheetErr.message)
      return res.status(503).json({ message: 'Could not verify enrollment right now. Please try again.' })
    }

    if (!sheetRow) {
      await logActivity({ userType: 'student', userLabel: mobile, action: 'login_fail', req, metadata: { reason: 'not_in_sheet' } })
      return res.status(404).json({ message: 'This mobile number is not in our enrollment records. Please register first.' })
    }

    const rawLevel = normaliseLevel(sheetRow.level)
    const level = normalizeStudentLevel(rawLevel || sheetRow.level)
    if (!level) {
      await logActivity({ userType: 'student', userLabel: mobile, action: 'login_fail', req, metadata: { reason: 'invalid_level', level: sheetRow.level } })
      return res.status(422).json({ message: `Unrecognised level "${sheetRow.level}". Please contact your teacher.` })
    }

    const { rows: created } = await pool.query(
      `INSERT INTO students (name, mobile, level, registration_date)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (mobile) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [sheetRow.name || 'Student', mobile, level]
    )
    
    await logActivity({ userType: 'student', userId: created[0].id, userLabel: created[0].name, action: 'login_success', req, metadata: { first_login: true } })
    return res.status(201).json({ student: created[0] })
  } catch (err) {
    console.error('[login]', err)
    return res.status(500).json({ message: 'Server error during login: ' + (err.message || String(err)) })
  }
})

// ── GET /api/students/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const student = await getStudentById(parseInt(req.params.id, 10))
    if (!student) return res.status(404).json({ message: 'Student not found.' })
    res.json(student)
  } catch {
    res.status(400).json({ message: 'Invalid student ID.' })
  }
})

// ── GET /api/students/:id/progress ───────────────────────────────────────────
router.get('/:id/progress', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10)
    const student = await getStudentById(studentId)
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const [{ rows: days }, streakResult] = await Promise.all([
      pool.query(
        `SELECT day_number, opened, opened_at, completed, completed_at,
                accuracy, time_taken_seconds, xp_earned, total_marks
         FROM day_records WHERE student_id = $1 ORDER BY day_number`,
        [studentId]
      ),
      recalculateStreak(studentId, student.registration_date),
    ])

    res.json({
      days,
      streak: streakResult.streak,
      longestStreak: streakResult.longestStreak,
      currentDay: getChallengeDay(student.registration_date),
    })
  } catch (err) {
    console.error('[progress]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/students/:id/progress/:dayNumber ─────────────────────────────────
router.get('/:id/progress/:dayNumber', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM day_records WHERE student_id = $1 AND day_number = $2`,
      [parseInt(req.params.id, 10), parseInt(req.params.dayNumber, 10)]
    )
    res.json(rows[0] ?? null)
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── POST /api/students/:id/progress/:dayNumber/open ───────────────────────────
router.post('/:id/progress/:dayNumber/open', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10)
    const dayNumber = parseInt(req.params.dayNumber, 10)
    const student = await getStudentById(studentId)
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const currentDay = getChallengeDay(student.registration_date)
    if (dayNumber !== currentDay) {
      return res.status(403).json({ message: 'This day is not currently active.' })
    }

    const { rows: existing } = await pool.query(
      `SELECT * FROM day_records WHERE student_id = $1 AND day_number = $2`,
      [studentId, dayNumber]
    )
    if (existing[0]?.completed) {
      return res.status(409).json({ message: 'This day has already been completed.' })
    }

    const { rows } = await pool.query(
      `INSERT INTO day_records (student_id, day_number, opened, opened_at)
       VALUES ($1, $2, TRUE, NOW())
       ON CONFLICT (student_id, day_number)
       DO UPDATE SET opened = TRUE, opened_at = COALESCE(day_records.opened_at, NOW()), updated_at = NOW()
       RETURNING *`,
      [studentId, dayNumber]
    )
    
    await logActivity({ userType: 'student', userId: studentId, userLabel: student.name, action: 'day_open', req, metadata: { day: dayNumber } })
    res.json(rows[0])
  } catch (err) {
    console.error('[open]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/students/:id/progress/:dayNumber/sections ────────────────────────
// Returns section list with completion status from section_data in day_records
router.get('/:id/progress/:dayNumber/sections', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10)
    const dayNumber = parseInt(req.params.dayNumber, 10)
    const student = await getStudentById(studentId)
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const level = normalizeStudentLevel(student.level) || student.level
    const sections = getSectionsForLevel(level, dayNumber)

    // Fetch completion metadata from day_records.section_data
    const { rows: dayRows } = await pool.query(
      `SELECT section_data, completed FROM day_records WHERE student_id = $1 AND day_number = $2`,
      [studentId, dayNumber]
    )
    const sectionData = dayRows[0]?.section_data || {}
    const paperCompleted = dayRows[0]?.completed || false

    // For every-5th-day, check if teacher submitted
    let teacherDayReady = true
    if (isTeacherDay(dayNumber)) {
      const tq = await getTeacherQuestion(level, dayNumber)
      teacherDayReady = !!tq
    }

    const result = sections.map(sec => ({
      section: sec,
      label: SECTION_LABELS[sec] || sec,
      status: sectionData[sec]?.status || 'not_started',
      questionCount: sectionData[sec]?.questionCount || 5,
      timeTaken: sectionData[sec]?.timeTaken || 0,
      marks: sectionData[sec]?.marks || 0,
    }))

    res.json({
      sections: result,
      paperCompleted,
      isTeacherDay: isTeacherDay(dayNumber),
      teacherDayReady,
      level,
      dayNumber,
    })
  } catch (err) {
    console.error('[sections]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── POST /api/students/:id/progress/:dayNumber/sections/:section/open ─────────
router.post('/:id/progress/:dayNumber/sections/:section/open', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10)
    const dayNumber = parseInt(req.params.dayNumber, 10)
    const section = req.params.section
    const student = await getStudentById(studentId)
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const currentDay = getChallengeDay(student.registration_date)
    if (dayNumber !== currentDay) {
      return res.status(403).json({ message: 'This day is not currently active.' })
    }

    // Fetch existing section_data
    const { rows } = await pool.query(
      `SELECT section_data FROM day_records WHERE student_id = $1 AND day_number = $2`,
      [studentId, dayNumber]
    )
    const sectionData = rows[0]?.section_data || {}

    if (sectionData[section]?.status === 'done') {
      return res.status(409).json({ message: 'This section has already been completed.' })
    }

    // Mark section as in_progress
    sectionData[section] = { ...sectionData[section], status: 'in_progress' }

    await pool.query(
      `UPDATE day_records SET section_data = $1, updated_at = NOW()
       WHERE student_id = $2 AND day_number = $3`,
      [JSON.stringify(sectionData), studentId, dayNumber]
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('[section/open]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/students/:id/progress/:dayNumber/sections/:section/questions ──────
router.get('/:id/progress/:dayNumber/sections/:section/questions', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10)
    const dayNumber = parseInt(req.params.dayNumber, 10)
    const section = req.params.section

    const student = await getStudentById(studentId)
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const level = normalizeStudentLevel(student.level) || student.level

    // Every-5th-day or teacher section: fetch from teacher_questions
    if (section === 'teacher_day' || TEACHER_INPUT_SECTIONS.has(section)) {
      const tq = await getTeacherQuestion(level, dayNumber, section === 'teacher_day' ? 'teacher_day' : section)
      if (!tq) {
        return res.status(404).json({
          message: "Today's question is being prepared by your teacher. Please check back shortly.",
          teacherNotReady: true,
        })
      }
      return res.json({
        questions: [{
          id: tq.id,
          section,
          question_type: 'teacher',
          question_text: tq.question,
          answer: tq.answer,
          display_text: tq.question,
        }],
      })
    }

    // Auto-generated sections: fetch from question_bank
    const questions = await selectQuestionsForDay(level, section, dayNumber)
    if (!questions.length) {
      return res.status(404).json({ message: 'No questions found for this section.' })
    }

    res.json({ questions })
  } catch (err) {
    console.error('[section/questions]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── POST /api/students/:id/progress/:dayNumber/sections/:section/submit ────────
router.post('/:id/progress/:dayNumber/sections/:section/submit', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10)
    const dayNumber = parseInt(req.params.dayNumber, 10)
    const section = req.params.section
    const { responses, timeTakenSeconds } = req.body

    const student = await getStudentById(studentId)
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const level = normalizeStudentLevel(student.level) || student.level
    const tableName = level === 'alumni' ? 'responses_alumni' : `responses_l${level.replace('l', '')}`

    // Calculate section score
    const correct = responses.filter(r => r.is_correct).length
    const marks = correct * 10
    const xpEarned = correct * 10
    const accuracy = responses.length > 0 ? Math.round((correct / responses.length) * 100) : 0

    // Insert responses into per-level table
    for (const r of responses) {
      await pool.query(
        `INSERT INTO ${tableName}
         (student_id, day_number, section_name, question_id, question_snapshot,
          correct_answer, student_answer, is_correct, time_taken_seconds, xp_earned)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          studentId, dayNumber, section,
          r.question_id || null,
          r.question_snapshot || '',
          String(r.correct_answer),
          r.student_answer !== undefined ? String(r.student_answer) : null,
          r.is_correct,
          r.time_taken_seconds || 0,
          r.is_correct ? 10 : 0,
        ]
      )
    }

    // Update section_data in day_records
    const { rows: dayRows } = await pool.query(
      `SELECT section_data FROM day_records WHERE student_id = $1 AND day_number = $2`,
      [studentId, dayNumber]
    )
    const sectionData = dayRows[0]?.section_data || {}
    sectionData[section] = {
      status: 'done',
      questionCount: responses.length,
      correct,
      marks,
      xpEarned,
      accuracy,
      timeTaken: timeTakenSeconds,
    }

    await pool.query(
      `UPDATE day_records SET section_data = $1, updated_at = NOW()
       WHERE student_id = $2 AND day_number = $3`,
      [JSON.stringify(sectionData), studentId, dayNumber]
    )

    res.json({ success: true, marks, xpEarned, accuracy, correct, total: responses.length })
  } catch (err) {
    console.error('[section/submit]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── POST /api/students/:id/progress/:dayNumber/submit — submit full paper ──────
router.post('/:id/progress/:dayNumber/submit', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10)
    const dayNumber = parseInt(req.params.dayNumber, 10)
    const student = await getStudentById(studentId)
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const { rows: dayRows } = await pool.query(
      `SELECT section_data FROM day_records WHERE student_id = $1 AND day_number = $2`,
      [studentId, dayNumber]
    )

    const sectionData = dayRows[0]?.section_data || {}
    const level = normalizeStudentLevel(student.level) || student.level
    const sections = getSectionsForLevel(level, dayNumber)

    // Verify all sections are done
    const allDone = sections.every(sec => sectionData[sec]?.status === 'done')
    if (!allDone) {
      return res.status(400).json({ message: 'Not all sections are completed yet.' })
    }

    // Aggregate totals
    let totalMarks = 0, totalXp = 0, totalTime = 0, totalCorrect = 0, totalQs = 0

    for (const sec of sections) {
      const sd = sectionData[sec] || {}
      totalMarks += sd.marks || 0
      totalXp += sd.xpEarned || 0
      totalTime += sd.timeTaken || 0
      totalCorrect += sd.correct || 0
      totalQs += sd.questionCount || 0
    }

    const accuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0

    // Streak bonus: +5 XP per active consecutive day
    const streakResult = await recalculateStreak(studentId, student.registration_date)
    const streakBonus = streakResult.streak * 5
    totalXp += streakBonus

    // Mark paper complete and update student XP
    await pool.query(
      `UPDATE day_records
       SET completed = TRUE, completed_at = NOW(), total_marks = $1, accuracy = $2,
           time_taken_seconds = $3, xp_earned = $4, updated_at = NOW()
       WHERE student_id = $5 AND day_number = $6`,
      [totalMarks, accuracy, totalTime, totalXp, studentId, dayNumber]
    )

    // Update student's cumulative XP and streak
    await pool.query(
      `UPDATE students SET xp_total = xp_total + $1, streak = $2, longest_streak = GREATEST(longest_streak, $3), updated_at = NOW()
       WHERE id = $4`,
      [totalXp, streakResult.streak, streakResult.longestStreak, studentId]
    )

    await logActivity({ userType: 'student', userId: studentId, userLabel: student.name, action: 'day_complete', req, metadata: { day: dayNumber, accuracy, totalMarks, totalXp } })

    res.json({
      success: true,
      totalMarks,
      totalXp,
      streakBonus,
      accuracy,
      totalTime,
      totalCorrect,
      totalQs,
      sectionData,
    })
  } catch (err) {
    console.error('[paper/submit]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── GET /api/students/:id/progress/:dayNumber/report ──────────────────────────
router.get('/:id/progress/:dayNumber/report', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10)
    const dayNumber = parseInt(req.params.dayNumber, 10)
    const student = await getStudentById(studentId)
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const level = normalizeStudentLevel(student.level) || student.level
    const tableName = level === 'alumni' ? 'responses_alumni' : `responses_l${level.replace('l', '')}`

    const [dayRecord, responses] = await Promise.all([
      pool.query(`SELECT * FROM day_records WHERE student_id = $1 AND day_number = $2`, [studentId, dayNumber]),
      pool.query(
        `SELECT * FROM ${tableName} WHERE student_id = $1 AND day_number = $2 ORDER BY section_name, id`,
        [studentId, dayNumber]
      ),
    ])

    if (!dayRecord.rows[0]) return res.status(404).json({ message: 'Day record not found.' })

    res.json({
      day: dayRecord.rows[0],
      responses: responses.rows,
      student: { id: student.id, name: student.name, level: student.level, xp_total: student.xp_total },
    })
  } catch (err) {
    console.error('[report]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── Legacy question endpoint (backward compat for old DayModal) ───────────────
router.get('/:id/progress/:dayNumber/questions', async (req, res) => {
  try {
    const student = await getStudentById(parseInt(req.params.id, 10))
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const dayNumber = parseInt(req.params.dayNumber, 10)
    const { rows: questions } = await pool.query(
      `SELECT id, question_text AS title, question_type AS type,
              expected_answer AS "computedAnswer", format_example AS "formatExample"
       FROM questions WHERE level = $1 AND day_number = $2 ORDER BY id ASC`,
      [student.level, dayNumber]
    )

    res.json({ questions, submitUrl: '' })
  } catch (err) {
    res.status(500).json({ message: 'Server error.' })
  }
})

export default router
