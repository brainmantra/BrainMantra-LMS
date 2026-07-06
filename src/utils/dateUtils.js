/* global Intl */
function getISTMidnightUTC(d = new Date()) {
  const date = new Date(d)
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric' }
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date)
  const p = {}
  parts.forEach(({ type, value }) => { p[type] = parseInt(value, 10) })
  return Date.UTC(p.year, p.month - 1, p.day)
}

export function getChallengeDay(registrationDate, now = new Date()) {
  const thresholdUTC = Date.UTC(2026, 6, 15) // July 15, 2026 (Month is 0-indexed: 6 = July)
  const regDay = Math.max(getISTMidnightUTC(registrationDate), thresholdUTC)
  const today = getISTMidnightUTC(now)
  const diffDays = Math.round((today - regDay) / 86_400_000)
  if (diffDays < 0) return 0
  return diffDays + 1
}

export function getDayDate(registrationDate, dayNumber) {
  const thresholdUTC = Date.UTC(2026, 6, 15) // July 15, 2026 (Month is 0-indexed: 6 = July)
  const regDayUTC = Math.max(getISTMidnightUTC(registrationDate), thresholdUTC)
  const targetDayUTC = regDayUTC + (dayNumber - 1) * 86_400_000
  return new Date(targetDayUTC) // This will be used by formatDate
}

export function isDayToday(registrationDate, dayNumber) {
  const currentDay = getChallengeDay(registrationDate)
  return dayNumber === currentDay
}

export function isDayPast(registrationDate, dayNumber) {
  const currentDay = getChallengeDay(registrationDate)
  return dayNumber < currentDay
}

export function formatDate(date) {
  // Assuming 'date' is a Date object representing midnight UTC of the target day.
  // We want to display its UTC date as local string.
  const d = new Date(date)
  // To avoid local timezone shifts changing the day, we format in UTC:
  return d.toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

export function getTimeUntilMidnight() {
  // Midnight in IST
  const now = new Date()
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric' }
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now)
  const p = {}
  parts.forEach(({ type, value }) => { p[type] = parseInt(value, 10) })
  
  // Next midnight in IST
  // const nextMidnightISTString = `${p.month}/${p.day + 1}/${p.year} 00:00:00`
  // More robust way to find next IST midnight:
  // Date.UTC of tomorrow's IST date, minus Date.UTC of today's IST date? No, time remaining is actual ms.
  // Let's use a simpler approach: get current time in IST, find ms to 24:00:00.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  });
  const timeString = formatter.format(now); // "23:59:59" or "24:00:00"
  let [hours, minutes, seconds] = timeString.split(':').map(Number);
  if (hours === 24) hours = 0;
  
  const msPassedToday = (hours * 3600 + minutes * 60 + seconds) * 1000;
  const msInDay = 24 * 3600 * 1000;
  
  return msInDay - msPassedToday;
}
