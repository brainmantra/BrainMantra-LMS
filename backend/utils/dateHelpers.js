function getISTMidnightUTC(d = new Date()) {
  const date = new Date(d)
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric' }
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date)
  const p = {}
  parts.forEach(({ type, value }) => { p[type] = parseInt(value, 10) })
  // p.month is 1-12
  return Date.UTC(p.year, p.month - 1, p.day)
}

/**
 * Returns the challenge day number (1-indexed) for a registration date, as of now.
 * Day 1 = registration day, Day 2 = next day, etc.
 * Uses IST (Asia/Kolkata) consistently.
 */
export function getChallengeDay(registrationDate, now = new Date()) {
  const thresholdUTC = Date.UTC(2026, 6, 15) // July 15, 2026 (Month is 0-indexed: 6 = July)
  const regDay = Math.max(getISTMidnightUTC(registrationDate), thresholdUTC)
  const today = getISTMidnightUTC(now)
  const diffDays = Math.round((today - regDay) / 86_400_000)
  if (diffDays < 0) return 0
  return diffDays + 1
}

export function isSameCalendarDay(a, b) {
  return getISTMidnightUTC(a) === getISTMidnightUTC(b)
}

export function startOfDay(date = new Date()) {
  // Not used directly for diffing anymore, but if needed, we return a local date 
  // that represents the start of the day in local time.
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Returns the Monday that starts the current ISO week. */
export function getWeekStart(date = new Date()) {
  const d   = new Date(date)
  const day = d.getDay()                      // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  const mon  = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

export function getWeekLabel(date = new Date()) {
  const start = getWeekStart(date)
  const end   = new Date(start)
  end.setDate(start.getDate() + 6)
  const fmt = x => x.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}
