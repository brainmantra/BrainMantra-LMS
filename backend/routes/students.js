/**
 * routes/students.js — Student API (section-based paper flow)
 */
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../db.js'
import { getChallengeDay } from '../utils/dateHelpers.js'
import { recalculateStreak } from '../utils/streak.js'
import {
  selectQuestionsForDay,
  getTeacherQuestion,
  getSectionsForLevel,
  getSectionsForLevelAsync,
  isTeacherDay,
  SECTION_LABELS,
  TEACHER_INPUT_SECTIONS,
  LEVEL_SECTIONS,
} from '../utils/questionSelector.js'
import { logActivity } from '../utils/logger.js'

const router = Router()

// ── Helper ────────────────────────────────────────────────────────────────────
async function getStudentById(id) {
  if (id === 9999) {
    return {
      id: 9999,
      name: 'Test Student',
      mobile: '0000000000',
      username: 'test',
      level: 'l1',
      registration_date: new Date().toISOString(),
      first_login_date: new Date().toISOString(),
      streak: 0,
      longest_streak: 0,
      xp_total: 0
    }
  }
  const { rows } = await pool.query('SELECT * FROM students WHERE id = $1', [id])
  return rows[0] ?? null
}

function normalizeStudentLevel(raw) {
  if (!raw) return null
  const s = raw.toLowerCase().trim()
  if (s === 'beginner') return 'beginner'
  if (s === 'gm') return 'gm'
  if (s === 'alumni') return 'alumni'
  if (/^l[1-8]$/i.test(s)) return s
  if (/^[1-8]$/.test(s)) return `l${s}`
  
  const map = { elementary: 'l2', intermediate: 'l3', advanced: 'l4', expert: 'l5' }
  return map[s] || s
}

// ── POST /api/students/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body
    if (!loginId || !password) {
      return res.status(400).json({ message: 'Login ID and Password are required.' })
    }

    const cleanLoginId = String(loginId).trim().toLowerCase()

    if (cleanLoginId === 'test' && password === 'password') {
      return res.json({
        student: {
          id: 9999,
          name: 'Test Student',
          mobile: '0000000000',
          username: 'test',
          level: 'l1',
          registration_date: new Date().toISOString(),
          first_login_date: new Date().toISOString()
        }
      })
    }

    // 1. Search DB for matching username or mobile
    const { rows: existing } = await pool.query(
      'SELECT * FROM students WHERE LOWER(username) = $1 OR mobile = $2',
      [cleanLoginId, cleanLoginId]
    )

    if (existing.length === 0) {
      return res.status(401).json({ message: 'Invalid Login ID or Password.' })
    }

    const student = existing[0]

    // Verify password if a password_hash is set
    if (!student.password_hash) {
      return res.status(401).json({ message: 'Account not set up properly. Please contact your teacher.' })
    }
    
    const match = await bcrypt.compare(password, student.password_hash)
    if (!match) {
      await logActivity({ userType: 'student', userId: student.id, userLabel: student.name, action: 'login_fail', req, metadata: { reason: 'wrong_password' } })
      return res.status(401).json({ message: 'Incorrect password.' })
    }
      
    await logActivity({ userType: 'student', userId: student.id, userLabel: student.name, action: 'login_success', req })

    // Set first_login_date on first ever login (starts the 100-day challenge clock)
    if (!student.first_login_date) {
      await pool.query(
        `UPDATE students SET first_login_date = NOW() WHERE id = $1`,
        [student.id]
      )
      student.first_login_date = new Date().toISOString()
    }

    // Clean student object before sending
    const studentData = { ...student }
    delete studentData.password_hash
    delete studentData.plain_password
    return res.json({ student: studentData })

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
                accuracy, time_taken_seconds, xp_earned, total_marks, section_data
         FROM day_records WHERE student_id = $1 ORDER BY day_number`,
        [studentId]
      ),
      recalculateStreak(studentId, student.first_login_date || student.registration_date),
    ])

    res.json({
      days,
      streak: streakResult.streak,
      longestStreak: streakResult.longestStreak,
      currentDay: getChallengeDay(student.first_login_date || student.registration_date),
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

    const currentDay = getChallengeDay(student.first_login_date || student.registration_date)
    if (dayNumber !== currentDay && dayNumber !== 0) {
      return res.status(403).json({ message: 'This day is not currently active.' })
    }

    // Day 0 is Demo Day — always available, never written to DB
    if (dayNumber === 0) {
      return res.status(200).json({ message: 'Demo day opened.' })
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
    const sections = await getSectionsForLevelAsync(level, Math.max(1, dayNumber))

    // Demo Day (day 0) — return sections with no DB state; never mark as completed
    if (dayNumber === 0) {
      const result = []
      for (const sec of sections) {
        const isCustom = !LEVEL_SECTIONS[level]?.includes(sec) && sec !== 'power_exercise'
        const isTeacherInput = TEACHER_INPUT_SECTIONS.has(sec) || isCustom

        let ready = false
        if (sec === 'power_exercise') {
          ready = true
        } else if (isTeacherInput) {
          const tq = await getTeacherQuestion(level, 0, sec)
          ready = !!tq
        } else {
          ready = true
        }
        let countVal = 5;
        if (sec === 'power_exercise') {
          countVal = 10;
        } else if (isTeacherInput) {
          countVal = 1;
          const tq = await getTeacherQuestion(level, 0, sec)
          ready = !!tq
          if (tq && tq.question) {
            try {
              const parsed = typeof tq.question === 'string' ? JSON.parse(tq.question) : tq.question
              if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
                const qItems = parsed.items.filter(item => item.type === 'question')
                if (qItems.length > 0) {
                  countVal = qItems.length
                }
              }
            } catch (e) {}
          }
        }

        let labelVal = SECTION_LABELS[sec] || sec
        if (!SECTION_LABELS[sec]) {
          const tq = await getTeacherQuestion(level, 0, sec)
          if (tq && tq.question) {
            try {
              const parsed = typeof tq.question === 'string' ? JSON.parse(tq.question) : tq.question
              if (parsed && parsed.title) {
                labelVal = parsed.title
              }
            } catch (e) {}
          }
        }

        result.push({
          section: sec,
          label: labelVal,
          status: 'not_started',
          questionCount: countVal,
          timeTaken: 0,
          marks: 0,
          ready,
          isDemo: true,
        })
      }
      return res.json({
        sections: result.filter(s => s.ready),
        paperCompleted: false,
        isTeacherDay: false,
        teacherDayReady: false,
        level,
        dayNumber: 0,
        isDemo: true,
      })
    }

    // Fetch completion metadata from day_records.section_data
    const { rows: dayRows } = await pool.query(
      `SELECT section_data, completed FROM day_records WHERE student_id = $1 AND day_number = $2`,
      [studentId, dayNumber]
    )
    const sectionData = dayRows[0]?.section_data || {}
    const paperCompleted = dayRows[0]?.completed || false

    // Map each section and check if teacher questions are ready for teacher-input sections
    const result = []
    for (const sec of sections) {
      const isCustom = !LEVEL_SECTIONS[level]?.includes(sec) && sec !== 'power_exercise'
      const isTeacherInput = TEACHER_INPUT_SECTIONS.has(sec) || isCustom

      let ready = true
      let countVal = 5;
      if (sec === 'power_exercise') {
        countVal = 10;
      } else if (isTeacherInput) {
        countVal = 1;
        const tq = await getTeacherQuestion(level, dayNumber, sec)
        ready = !!tq
        if (tq && tq.question) {
          try {
            const parsed = typeof tq.question === 'string' ? JSON.parse(tq.question) : tq.question
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
              const qItems = parsed.items.filter(item => item.type === 'question')
              if (qItems.length > 0) {
                countVal = qItems.length
              }
            }
          } catch (e) {}
        }
      }

      let labelVal = SECTION_LABELS[sec] || sec
      if (!SECTION_LABELS[sec]) {
        const tq = await getTeacherQuestion(level, dayNumber, sec)
        if (tq && tq.question) {
          try {
            const parsed = typeof tq.question === 'string' ? JSON.parse(tq.question) : tq.question
            if (parsed && parsed.title) {
              labelVal = parsed.title
            }
          } catch (e) {}
        }
      }

      result.push({
        section: sec,
        label: labelVal,
        status: sectionData[sec]?.status || 'not_started',
        questionCount: sectionData[sec]?.questionCount || countVal,
        timeTaken: sectionData[sec]?.timeTaken || 0,
        marks: sectionData[sec]?.marks || 0,
        ready,
      })
    }

    res.json({
      sections: result,
      paperCompleted,
      isTeacherDay: isTeacherDay(dayNumber),
      teacherDayReady: true,
      level,
      dayNumber,
    })
  } catch (err) {
    console.error('[sections]', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── POST /api/students/:id/progress/:dayNumber/sections/:section/open ─────────
// Marks a section as started (in_progress) in section_data
router.post('/:id/progress/:dayNumber/sections/:section/open', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10)
    const dayNumber = parseInt(req.params.dayNumber, 10)
    const section = req.params.section

    const student = await getStudentById(studentId)
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const level = normalizeStudentLevel(student.level) || student.level

    // Update section_data in day_records
    const { rows } = await pool.query(
      `SELECT section_data FROM day_records WHERE student_id = $1 AND day_number = $2`,
      [studentId, dayNumber]
    )
    const sectionData = rows[0]?.section_data || {}

    if (!sectionData[section]) {
      sectionData[section] = { status: 'in_progress', startedAt: new Date().toISOString() }
      await pool.query(
        `UPDATE day_records
         SET section_data = $1, updated_at = NOW()
         WHERE student_id = $2 AND day_number = $3`,
        [sectionData, studentId, dayNumber]
      )
    }

    res.json({ success: true, sectionData })
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

    // Check if this section exists in teacher_questions
    const tq = await getTeacherQuestion(level, dayNumber, section)
    const isCustomTeacherSection = !!tq

    // Every-5th-day or teacher section: fetch from teacher_questions
    if (section === 'teacher_day' || TEACHER_INPUT_SECTIONS.has(section) || isCustomTeacherSection) {
      if (dayNumber === 0 && section === 'power_exercise') {
        const tq = await getTeacherQuestion(level, 0, 'power_exercise')
        if (tq) {
          return res.json({
            questions: [{
              id: tq.id,
              section,
              question_type: 'teacher',
              question_text: tq.question,
              answer: tq.answer,
              display_text: tq.question,
              format_example: tq.format_example,
            }],
          })
        }
        const demoQuestion = {
          id: 9999,
          section: 'power_exercise',
          question_type: 'teacher',
          question_text: JSON.stringify([
            { type: 'text', content: 'Add 11 \n10 Times \nWrite Each Step Answer' },
            { type: 'step', answer: '11' },
            { type: 'step', answer: '22' },
            { type: 'step', answer: '33' },
            { type: 'step', answer: '44' },
            { type: 'step', answer: '55' },
            { type: 'step', answer: '66' },
            { type: 'step', answer: '77' },
            { type: 'step', answer: '88' },
            { type: 'step', answer: '99' },
            { type: 'step', answer: '110' },
          ]),
          answer: JSON.stringify(['11', '22', '33', '44', '55', '66', '77', '88', '99', '110']),
          display_text: 'Add 11 \n10 Times \nWrite Each Step Answer',
          format_example: 'Write the value of each step',
        }
        return res.json({ questions: [demoQuestion] })
      }

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
          format_example: tq.format_example,
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
    let tableName = `responses_l${level.replace('l', '')}`
    if (level === 'alumni') tableName = 'responses_alumni'
    else if (level === 'beginner') tableName = 'responses_beginner'
    else if (level === 'gm') tableName = 'responses_gm'

    // Calculate section score
    let correct = responses.filter(r => r.is_correct).length
    let totalQuestions = responses.length
    let marks = correct * 10
    let xpEarned = correct * 10
    let accuracy = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0

    if (section === 'power_exercise') {
      const r = responses[0]
      if (r) {
        try {
          const studentAnsList = JSON.parse(r.student_answer)
          const correctAnsList = JSON.parse(r.correct_answer)
          if (Array.isArray(studentAnsList) && Array.isArray(correctAnsList)) {
            const normalize = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim()
            let correctSteps = 0
            correctAnsList.forEach((cStep, idx) => {
              if (normalize(studentAnsList[idx]) === normalize(cStep)) {
                correctSteps++
              }
            })
            correct = correctSteps
            totalQuestions = correctAnsList.length
            marks = correct * 10
            xpEarned = correct * 10
            accuracy = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0
          }
        } catch (e) {
          console.error('Error parsing power exercise answers on submit:', e)
        }
      }
    }

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
          section === 'power_exercise' ? xpEarned : (r.is_correct ? 10 : 0),
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
      questionCount: totalQuestions,
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

    const { force } = req.body || {}
    const { rows: dayRows } = await pool.query(
      `SELECT section_data FROM day_records WHERE student_id = $1 AND day_number = $2`,
      [studentId, dayNumber]
    )

    const sectionData = dayRows[0]?.section_data || {}
    const level = normalizeStudentLevel(student.level) || student.level
    const sections = await getSectionsForLevelAsync(level, dayNumber)

    // Verify all sections are done
    const allDone = sections.every(sec => sectionData[sec]?.status === 'done')
    if (!allDone) {
      if (force) {
        // Automatically populate remaining sections with 0 marks
        for (const sec of sections) {
          if (sectionData[sec]?.status !== 'done') {
            sectionData[sec] = {
              status: 'done',
              questionCount: sec === 'power_exercise' ? 10 : (TEACHER_INPUT_SECTIONS.has(sec) || (!LEVEL_SECTIONS[level]?.includes(sec) && sec !== 'power_exercise') ? 1 : 5),
              correct: 0,
              marks: 0,
              xpEarned: 0,
              accuracy: 0,
              timeTaken: 0,
            }
          }
        }
      } else {
        return res.status(400).json({ message: 'Not all sections are completed yet.' })
      }
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
    const streakResult = await recalculateStreak(studentId, student.first_login_date || student.registration_date)
    const streakBonus = streakResult.streak * 5
    totalXp += streakBonus

    // Query all student responses from the per-level table
    let tableName = `responses_l${level.replace('l', '')}`
    if (level === 'alumni') tableName = 'responses_alumni'
    else if (level === 'beginner') tableName = 'responses_beginner'
    else if (level === 'gm') tableName = 'responses_gm'
    const { rows: studentResponses } = await pool.query(
      `SELECT section_name, question_snapshot, correct_answer, student_answer, is_correct, time_taken_seconds, xp_earned, answered_at 
       FROM ${tableName} 
       WHERE student_id = $1 AND day_number = $2
       ORDER BY answered_at ASC`,
      [studentId, dayNumber]
    )

    // Mark paper complete and update student XP
    await pool.query(
      `UPDATE day_records
       SET completed = TRUE, completed_at = NOW(), total_marks = $1, accuracy = $2,
           time_taken_seconds = $3, xp_earned = $4, answers = $5, section_data = $8, updated_at = NOW()
       WHERE student_id = $6 AND day_number = $7`,
      [totalMarks, accuracy, totalTime, totalXp, JSON.stringify(studentResponses), studentId, dayNumber, JSON.stringify(sectionData)]
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
    let tableName = `responses_l${level.replace('l', '')}`
    if (level === 'alumni') tableName = 'responses_alumni'
    else if (level === 'beginner') tableName = 'responses_beginner'
    else if (level === 'gm') tableName = 'responses_gm'

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
