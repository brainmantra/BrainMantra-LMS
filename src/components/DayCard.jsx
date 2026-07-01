import { useNavigate } from 'react-router-dom'
import { isDayToday, isDayPast, formatDate, getDayDate } from '../utils/dateUtils'
import './DayCard.css'

/**
 * Day status logic:
 * - 'locked'    : future day, not yet reachable
 * - 'today'     : today's day, not yet opened -> clickable
 * - 'opened'    : today's day, opened but form not submitted -> "Started" message
 * - 'completed' : form submitted (any day)
 * - 'missed'    : past day, never opened
 */
export default function DayCard({ dayNumber, registrationDate, dayRecord }) {
  const navigate = useNavigate()
  const dayDate = getDayDate(registrationDate, dayNumber)
  const today = isDayToday(registrationDate, dayNumber)
  const past = isDayPast(registrationDate, dayNumber)

  let status = 'locked'
  if (dayRecord?.completed) {
    status = 'completed'
  } else if (dayRecord?.opened && today) {
    status = 'opened'
  } else if (today) {
    status = 'today'
  } else if (past) {
    status = dayRecord?.opened ? 'opened-past' : 'missed'
  }

  const clickable = status === 'today'

  const handleClick = () => {
    if (!clickable) return
    navigate(`/challenge/day/${dayNumber}`)
  }

  const statusConfig = {
    locked: { icon: '🔒', label: 'Locked', cls: 'day-locked' },
    today: { icon: '▶', label: 'Start Now', cls: 'day-today' },
    opened: { icon: '⏳', label: 'Started — Not Submitted', cls: 'day-opened' },
    'opened-past': { icon: '⚠', label: 'Missed — Not Submitted', cls: 'day-missed' },
    completed: { icon: '✓', label: 'Completed', cls: 'day-completed' },
    missed: { icon: '✕', label: 'Missed', cls: 'day-missed' },
  }
  const cfg = statusConfig[status]

  return (
    <button
      className={`day-card ${cfg.cls} ${clickable ? 'day-clickable' : ''}`}
      onClick={handleClick}
      disabled={!clickable}
      title={`Day ${dayNumber} — ${formatDate(dayDate)}`}
    >
      <span className="day-card-num">{dayNumber}</span>
      <span className="day-card-icon">{cfg.icon}</span>
      <span className="day-card-status">{cfg.label}</span>
      <span className="day-card-date">{formatDate(dayDate)}</span>
    </button>
  )
}
