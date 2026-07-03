import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { isDayToday, isDayPast, formatDate, getDayDate, getTimeUntilMidnight } from '../utils/dateUtils'
import './DayCard.css'

export default function DayCard({ dayNumber, registrationDate, dayRecord }) {
  const navigate = useNavigate()
  const dayDate = getDayDate(registrationDate, dayNumber)
  const today = isDayToday(registrationDate, dayNumber)
  const past = isDayPast(registrationDate, dayNumber)

  let status = 'future'
  if (dayRecord?.completed) {
    status = 'completed'
  } else if (dayRecord?.opened && today) {
    status = 'opened'
  } else if (today) {
    status = 'today'
  } else if (past) {
    status = dayRecord?.opened ? 'opened-past' : 'missed'
  }

  const clickable = status === 'today' || status === 'opened'

  const handleClick = () => {
    if (!clickable) return
    navigate(`/challenge/day/${dayNumber}`)
  }

  // Timer logic for next day
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight())
  
  useEffect(() => {
    if (status !== 'future') return
    const timer = setInterval(() => {
      setTimeLeft(getTimeUntilMidnight())
    }, 1000)
    return () => clearInterval(timer)
  }, [status])

  const formatTimer = (ms) => {
    if (ms < 0) return "00:00:00"
    const h = Math.floor(ms / (1000 * 60 * 60))
    const m = Math.floor((ms / 1000 / 60) % 60)
    const s = Math.floor((ms / 1000) % 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const statusConfig = {
    future: { badge: '🔒 LOCKED', btn: formatTimer(timeLeft), btnClass: 'btn-future', icon: '⏱' },
    today: { badge: '▶ ACTIVE', btn: 'Start Now', btnClass: 'btn-today', icon: '' },
    opened: { badge: '⏳ IN PROGRESS', btn: 'Resume', btnClass: 'btn-opened', icon: '' },
    'opened-past': { badge: '✕ MISSED', btn: 'Missed', btnClass: 'btn-missed', icon: '' },
    completed: { badge: '✓ COMPLETED', btn: 'Completed', btnClass: 'btn-completed', icon: '✓' },
    missed: { badge: '✕ MISSED', btn: 'Missed', btnClass: 'btn-missed', icon: '' },
  }
  const cfg = statusConfig[status]

  return (
    <div className={`day-card-container ${status}`}>
      <div className="day-card-header">
        <h3 className="day-card-title">Day {dayNumber}</h3>
        <span className={`day-card-badge badge-${status}`}>{cfg.badge}</span>
      </div>

      <div className="day-card-date-label">{formatDate(dayDate)}</div>

      <button 
        className={`day-card-footer ${cfg.btnClass}`}
        onClick={handleClick}
        disabled={!clickable}
        style={{ cursor: clickable ? 'pointer' : 'default', border: 'none' }}
      >
        {cfg.icon && <span className="footer-icon">{cfg.icon}</span>}
        {cfg.btn}
      </button>
    </div>
  )
}
