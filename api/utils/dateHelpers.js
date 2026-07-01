/**
 * Returns the challenge day number (1-indexed) for a registration date, as of now.
 * Day 1 = registration day, Day 2 = next day, etc.
 */
export function getChallengeDay(registrationDate, now = new Date()) {
  const reg = new Date(registrationDate)
  const regDay = new Date(reg.getFullYear(), reg.getMonth(), reg.getDate())
  const today  = new Date(now.getFullYear(), now.getMonth(),  now.getDate())
  const diffDays = Math.floor((today - regDay) / 86_400_000)
  return Math.max(1, diffDays + 1)
}

export function isSameCalendarDay(a, b) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() &&
         da.getMonth()    === db.getMonth()    &&
         da.getDate()     === db.getDate()
}

export function startOfDay(date = new Date()) {
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
