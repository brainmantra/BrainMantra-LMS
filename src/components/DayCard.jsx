import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { isDayToday, isDayPast, formatDate, getDayDate, getTimeUntilMidnight } from '../utils/dateUtils'
import { useAuth } from '../context/AuthContext'
import './DayCard.css'

const LEVEL_SECTIONS = {
  l1: ['abacus', 'teacher_input'],
  l2: ['abacus', 'visual', 'teacher_input'],
  l3: ['abacus', 'visual', 'tables'],
  l4: ['abacus', 'visual', 'multiplication', 'division', 'form_the_question'],
  l5: ['abacus', 'visual', 'multiplication', 'division'],
  l6: ['abacus', 'visual', 'multiplication', 'division'],
  l7: ['abacus', 'visual', 'multiplication', 'division'],
  l8: ['abacus', 'visual', 'multiplication', 'division'],
  alumni: ['abacus', 'visual', 'multiplication', 'division'],
}

const SECTION_LABELS = {
  abacus: 'Abacus Section',
  visual: 'Visual Mental Math',
  multiplication: 'Multiplication sums',
  division: 'Division sums',
  tables: 'Tables verification',
  form_the_question: 'Form The Question',
  teacher_input: 'Teacher Section',
  teacher_day: 'Special Day Question',
}

const SECTION_SHORT_LABELS = {
  abacus: '🧮 Abacus',
  visual: '👁 Visual',
  multiplication: '✖ Mul',
  division: '➗ Div',
  tables: '📋 Tables',
  form_the_question: '✏ Form Q',
  teacher_input: '👨‍🏫 Teacher',
  teacher_day: '🌟 Special',
}

export default function DayCard({ dayNumber, registrationDate, dayRecord }) {
  const navigate = useNavigate()
  const { student } = useAuth()
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

  const clickable = status === 'today' || status === 'opened' || status === 'completed'

  const handleStartResume = () => {
    if (!clickable) return
    navigate(`/challenge/day/${dayNumber}/sections`)
  }

  const handleSolveSection = (secName) => {
    if (!clickable) return
    if (dayRecord?.completed) {
      navigate(`/challenge/day/${dayNumber}/report`)
    } else {
      navigate(`/challenge/day/${dayNumber}/sections/${secName}`)
    }
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
    future: { badge: 'LOCKED', btn: `Unlocks in ${formatTimer(timeLeft)}`, btnClass: 'btn-future', icon: '🔒' },
    today: { badge: 'ACTIVE', btn: 'Start Challenge', btnClass: 'btn-today', icon: '▶' },
    opened: { badge: 'IN PROGRESS', btn: 'Resume Paper', btnClass: 'btn-opened', icon: '⏳' },
    'opened-past': { badge: 'MISSED', btn: 'Time Expired', btnClass: 'btn-missed', icon: '✕' },
    completed: { badge: 'COMPLETED', btn: 'View Report', btnClass: 'btn-completed', icon: '✓' },
    missed: { badge: 'MISSED', btn: 'Time Expired', btnClass: 'btn-missed', icon: '✕' },
  }
  const cfg = statusConfig[status]

  // Determine sections list for this day
  const isTeacherDay = dayNumber % 5 === 0
  const studentLevel = student?.level || 'l1'
  const sections = isTeacherDay ? ['teacher_day'] : (LEVEL_SECTIONS[studentLevel] || ['abacus'])
  const sectionData = dayRecord?.section_data || {}

  return (
    <div className={`day-card-container ${status}`}>
      {/* Top Header Row */}
      <div className="day-card-header">
        <h2 className="day-card-title">Day {dayNumber}</h2>
        <span className={`day-card-badge badge-${status}`}>
          {status === 'completed' ? '✓ ' : status === 'future' ? '🔒 ' : ''}
          {cfg.badge}
        </span>
      </div>

      {/* Date label */}
      <div className="day-card-date-label">{formatDate(dayDate)}</div>

      {/* Section Tags */}
      <div className="day-card-tags">
        {sections.map(sec => (
          <span key={sec} className="day-card-tag-pill">
            {SECTION_SHORT_LABELS[sec] || sec}
          </span>
        ))}
      </div>

      {/* Questions/Sections List */}
      <div className="day-card-sections-list">
        {sections.map((sec, idx) => {
          const secStatus = sectionData[sec]?.status || 'not_started'
          const isSecDone = secStatus === 'done' || dayRecord?.completed
          
          return (
            <div key={sec} className="day-card-section-row">
              <div className="day-card-section-meta">
                <span className="day-card-section-index">Part {idx + 1}</span>
                {isSecDone && (
                  <span className="day-card-section-badge done">
                    DONE
                  </span>
                )}
              </div>
              <div className="day-card-section-name">
                {SECTION_LABELS[sec] || sec}
              </div>
              <button 
                className="btn-solve-section"
                onClick={() => handleSolveSection(sec)}
                disabled={!clickable}
              >
                {isSecDone ? 'Review' : 'Solve Part →'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Bottom Main Button */}
      <button 
        className={`day-card-footer ${cfg.btnClass}`}
        onClick={handleStartResume}
        disabled={status === 'future' || status === 'missed' || status === 'opened-past'}
      >
        <span className="footer-icon">{cfg.icon}</span>
        {cfg.btn}
      </button>
    </div>
  )
}
