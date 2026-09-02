import pool from '../db.js'
import { getChallengeDay } from './dateHelpers.js'

/**
 * Recalculates and saves streak for a single student.
 * Walks every elapsed challenge day from Day 1 up to today.
 * A past day without a completed record breaks the streak.
 * Today is excluded from streak-breaking (day isn't over yet).
 *
 * Returns { streak, longestStreak }
 */
export async function recalculateStreak(studentId, registrationDate, now = new Date()) {
  const currentDay = getChallengeDay(registrationDate, now)

  // Fetch all completed day records for this student
  const { rows } = await pool.query(
    `SELECT day_number FROM day_records
      WHERE student_id = $1 AND completed = TRUE`,
    [studentId]
  )
  const completedSet = new Set(rows.map(r => r.day_number))

  let runningStreak = 0
  let longest = 0

  for (let d = 1; d <= Math.min(currentDay, 100); d++) {
    if (completedSet.has(d)) {
      runningStreak++
      if (runningStreak > longest) longest = runningStreak
    } else {
      const isExtendedActive = ((d === 47 || d === 48 || d === 49) && currentDay <= 49)
      const isToday = d === currentDay
      if (isToday || isExtendedActive) break          // deadline active — don't penalise yet
      runningStreak = 0           // missed past day — break streak
    }
  }

  // Persist updated values — wrapped in try/catch so missing columns
  // (e.g. updated_at not yet migrated on prod DB) don't crash the caller
  try {
    await pool.query(
      `UPDATE students
          SET streak = $1, longest_streak = GREATEST(longest_streak, $2),
              last_streak_check = NOW(), updated_at = NOW()
        WHERE id = $3`,
      [runningStreak, longest, studentId]
    )
  } catch {
    // Fallback: update only the core streak columns if updated_at is missing
    try {
      await pool.query(
        `UPDATE students SET streak = $1, longest_streak = GREATEST(longest_streak, $2) WHERE id = $3`,
        [runningStreak, longest, studentId]
      )
    } catch (e2) {
      console.error('[streak] Could not persist streak update:', e2.message)
    }
  }

  return { streak: runningStreak, longestStreak: longest }
}
