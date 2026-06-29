/**
 * Returns the challenge day number for a given student.
 * Day 1 = registration date, Day 2 = registration + 1, etc.
 * Returns null if registration date is invalid.
 */
export function getChallengeDay(registrationDate) {
  const reg = new Date(registrationDate)
  const now = new Date()
  // Compare calendar dates only (midnight-based)
  const regDay = new Date(reg.getFullYear(), reg.getMonth(), reg.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = today - regDay
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDays + 1 // Day 1 on registration day
}

/**
 * Returns the date string for challenge day N.
 */
export function getDayDate(registrationDate, dayNumber) {
  const reg = new Date(registrationDate)
  const d = new Date(reg.getFullYear(), reg.getMonth(), reg.getDate())
  d.setDate(d.getDate() + dayNumber - 1)
  return d
}

/**
 * Checks if challenge day N is today.
 */
export function isDayToday(registrationDate, dayNumber) {
  const dayDate = getDayDate(registrationDate, dayNumber)
  const today = new Date()
  return (
    dayDate.getDate() === today.getDate() &&
    dayDate.getMonth() === today.getMonth() &&
    dayDate.getFullYear() === today.getFullYear()
  )
}

/**
 * Checks if a day is in the past (missed/completed).
 */
export function isDayPast(registrationDate, dayNumber) {
  const dayDate = getDayDate(registrationDate, dayNumber)
  const today = new Date()
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return dayDate < todayMidnight
}

/**
 * Checks if a day is in the future (locked).
 */
export function isDayFuture(registrationDate, dayNumber) {
  return !isDayToday(registrationDate, dayNumber) && !isDayPast(registrationDate, dayNumber)
}

/**
 * Format date as "Mon, Jun 29"
 */
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Get start of current ISO week (Monday)
 */
export function getWeekStart() {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const diff = (day === 0) ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}