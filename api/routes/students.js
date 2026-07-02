import { Router } from 'express'
import pool from '../db.js'
import { getChallengeDay } from '../utils/dateHelpers.js'
import { recalculateStreak } from '../utils/streak.js'
import { findInSheet, normaliseLevel } from '../utils/googleSheet.js'

const router = Router()

// ── Helper: fetch full student row ──────────────────────────────────────
async function getStudentById(id) {
  const { rows } = await pool.query('SELECT * FROM students WHERE id = $1', [id])
  return rows[0] ?? null
}

// ── Login — verify against Google Sheet, auto-provision if needed ───────
//
// Flow:
//   1. Check our own DB first (fast path for returning users).
//   2. If not in DB, fetch the Google Sheet and look up the mobile.
//   3. If found in sheet → create the student row in DB, then return it.
//   4. If not in sheet → 404 (not enrolled).
//
router.post('/login', async (req, res) => {
  try {
    const { mobile } = req.body
    if (!/^\d{10}$/.test(mobile ?? '')) {
      return res.status(400).json({ message: 'A valid 10-digit mobile number is required.' })
    }

    // 1. Fast path — already in our DB
    const { rows: existing } = await pool.query(
      'SELECT * FROM students WHERE mobile = $1',
      [mobile]
    )
    if (existing.length > 0) {
      return res.json({ student: existing[0] })
    }

    // 2. Not in DB — check Google Sheet
    let sheetRow
    try {
      sheetRow = await findInSheet(mobile)
    } catch (sheetErr) {
      console.error('[login] Sheet lookup failed:', sheetErr.message)
      // Sheet unavailable: still deny — we can't verify enrollment
      return res.status(503).json({
        message: 'Could not verify enrollment right now. Please try again in a moment.',
      })
    }

    if (!sheetRow) {
      return res.status(404).json({
        message: 'This mobile number is not in our enrollment records. Please register first.',
      })
    }

    // 3. Found in sheet — provision the student
    const level = normaliseLevel(sheetRow.level)
    if (!level) {
      return res.status(422).json({
        message: `Unrecognised level "${sheetRow.level}" in the enrollment sheet. Please contact your teacher.`,
      })
    }

    const { rows: created } = await pool.query(
      `INSERT INTO students (name, mobile, level, registration_date)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (mobile) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [sheetRow.name || 'Student', mobile, level]
    )

    return res.status(201).json({ student: created[0] })
  } catch (err) {
    console.error('[login] Error:', err)
    return res.status(500).json({ message: 'Server error during login.' })
  }
})

// ── Re-verify session (called by AuthContext on app load) ────────────────
router.get('/:id', async (req, res) => {
  try {
    const student = await getStudentById(parseInt(req.params.id, 10))
    if (!student) return res.status(404).json({ message: 'Student not found.' })
    res.json(student)
  } catch {
    res.status(400).json({ message: 'Invalid student ID.' })
  }
})

// ── Full progress (all day records + streak) ─────────────────────────────
router.get('/:id/progress', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10)
    const student   = await getStudentById(studentId)
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const [{ rows: days }, streakResult] = await Promise.all([
      pool.query(
        `SELECT day_number, opened, opened_at, completed, completed_at,
                accuracy, time_taken_seconds
           FROM day_records WHERE student_id = $1 ORDER BY day_number`,
        [studentId]
      ),
      recalculateStreak(studentId, student.registration_date),
    ])

    res.json({
      days,
      streak:        streakResult.streak,
      longestStreak: streakResult.longestStreak,
      currentDay:    getChallengeDay(student.registration_date),
    })
  } catch (err) {
    console.error('[progress] Error:', err)
    res.status(500).json({ message: 'Server error fetching progress.' })
  }
})

// ── Single day record ────────────────────────────────────────────────────
router.get('/:id/progress/:dayNumber', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10)
    const dayNumber = parseInt(req.params.dayNumber, 10)
    const { rows } = await pool.query(
      `SELECT * FROM day_records WHERE student_id = $1 AND day_number = $2`,
      [studentId, dayNumber]
    )
    res.json(rows[0] ?? null)
  } catch (err) {
    console.error('[day-get] Error:', err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ── Mark day "opened" (one-time) ─────────────────────────────────────────
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

    // Check if already opened
    const { rows: existing } = await pool.query(
      `SELECT * FROM day_records WHERE student_id = $1 AND day_number = $2`,
      [studentId, dayNumber]
    )
    if (existing[0]?.opened) {
      return res.status(409).json({ message: 'This day has already been opened.' })
    }

    // Upsert: insert or mark opened
    const { rows } = await pool.query(
      `INSERT INTO day_records (student_id, day_number, opened, opened_at)
       VALUES ($1, $2, TRUE, NOW())
       ON CONFLICT (student_id, day_number)
       DO UPDATE SET opened = TRUE, opened_at = NOW(), updated_at = NOW()
       RETURNING *`,
      [studentId, dayNumber]
    )
    res.json(rows[0])
  } catch (err) {
    console.error('[open] Error:', err)
    res.status(500).json({ message: 'Server error opening day.' })
  }
})

export default router
