import { Router } from 'express'
import pool from '../db.js'
import { getChallengeDay } from '../utils/dateHelpers.js'
import { recalculateStreak } from '../utils/streak.js'

const router = Router()

/**
 * POST /api/webhooks/form-submit
 * Receives webhook payloads from Google Apps Script when a student submits a Google Form.
 * Payload should contain { mobile }
 */
router.post('/form-submit', async (req, res) => {
  try {
    let { mobile } = req.body
    
    // Normalize mobile to 10 digits
    mobile = (mobile || '').toString().replace(/\D/g, '').slice(-10)

    if (!mobile || mobile.length !== 10) {
      return res.status(400).json({ message: 'Invalid or missing mobile number' })
    }

    console.log(`[webhook] Received form submission for mobile: ${mobile}`)

    // 1. Find the student
    const { rows: students } = await pool.query('SELECT * FROM students WHERE mobile = $1', [mobile])
    const student = students[0]

    if (!student) {
      console.warn(`[webhook] Unknown mobile number: ${mobile}`)
      return res.status(404).json({ message: 'Student not found' })
    }

    // 2. Get their current challenge day
    const currentDay = getChallengeDay(student.registration_date)

    // 3. Mark the day as completed if it was opened
    // Note: We only complete the current day. If they somehow submit an old form, it doesn't count.
    const { rows: dayRecords } = await pool.query(
      `UPDATE day_records
          SET completed = TRUE, 
              completed_at = NOW(),
              updated_at = NOW()
        WHERE student_id = $1 AND day_number = $2 AND opened = TRUE
        RETURNING *`,
      [student.id, currentDay]
    )

    if (dayRecords.length === 0) {
      console.warn(`[webhook] Student ${student.id} submitted form, but Day ${currentDay} is not currently opened.`)
      // It might be a duplicate submission, or they submitted without clicking the UI first.
      // Depending on rules, we could auto-open it here, but let's stick to the flow.
      return res.status(409).json({ message: 'Day not opened' })
    }

    // 4. Recalculate streak
    await recalculateStreak(student.id, student.registration_date)
    
    console.log(`[webhook] Successfully verified and completed Day ${currentDay} for student ${student.id}`)
    return res.status(200).json({ message: 'Success' })

  } catch (err) {
    console.error('[webhook] Error processing form submission:', err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

export default router
