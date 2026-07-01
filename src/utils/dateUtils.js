export function getChallengeDay(registrationDate) {
  const reg = new Date(registrationDate)
  const now = new Date()
  const regDay = new Date(reg.getFullYear(), reg.getMonth(), reg.getDate())
  const today  = new Date(now.getFullYear(), now.getMonth(),  now.getDate())
  return Math.max(1, Math.floor((today - regDay) / 86_400_000) + 1)
}

export function getDayDate(registrationDate, dayNumber) {
  const reg = new Date(registrationDate)
  const d   = new Date(reg.getFullYear(), reg.getMonth(), reg.getDate())
  d.setDate(d.getDate() + dayNumber - 1)
  return d
}

export function isDayToday(registrationDate, dayNumber) {
  const dayDate = getDayDate(registrationDate, dayNumber)
  const now     = new Date()
  return dayDate.getDate()     === now.getDate()  &&
         dayDate.getMonth()    === now.getMonth()  &&
         dayDate.getFullYear() === now.getFullYear()
}

export function isDayPast(registrationDate, dayNumber) {
  const dayDate    = getDayDate(registrationDate, dayNumber)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return dayDate < todayStart
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}
