import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { isDayToday, isDayPast, formatDate, getDayDate, getTimeUntilMidnight } from '../utils/dateUtils'
import { useAuth } from '../context/AuthContext'
import './DayCard.css'

const LEVEL_SECTIONS = {
  beginner: ['abacus', 'bead_fun', 'activity'],
  l1: ['abacus', 'bead_fun', 'activity'],
  l2: ['abacus', 'visual', 'tables'],
  l3: ['abacus', 'visual', 'multiplication', 'two_steps'],
  l4: ['abacus', 'visual', 'multiplication', 'division', 'form_the_question'],
  l5: ['abacus', 'visual', 'multiplication', 'division', 'cracking'],
  l6: ['abacus', 'visual', 'multiplication', 'division', 'bodmas'],
  l7: ['abacus', 'visual', 'multiplication', 'division', 'two_steps'],
  l8: ['abacus', 'visual', 'multiplication', 'division', 'cracking'],
  alumni: ['abacus', 'visual', 'multiplication', 'division', 'cracking'],
  gm: ['abacus', 'visual', 'multiplication', 'division', 'cracking'],
}

const SECTION_LABELS = {
  abacus: '🧮 Abacus Section',
  bead_fun: '🧮 Bead Fun',
  activity: '⚡ Activity',
  visual: '👁 Visual Mental Math',
  multiplication: '✖ Multiplication sums',
  division: '➗ Division sums',
  tables: '📋 Tables verification',
  form_the_question: '✏ Form The Question',
  teacher_input: '👨‍🏫 Teacher Section',
  teacher_day: '🌟 Special Day Question',
  two_steps: '📋 2 Steps',
  cracking: '✏ Cracking',
  bodmas: '🧮 Bodmas',
  power_exercise: '⚡ Power Exercise',
}

const SECTION_SHORT_LABELS = {
  abacus: '🧮 Abacus',
  bead_fun: '🧮 Bead Fun',
  activity: '⚡ Activity',
  visual: '👁 Visual',
  multiplication: '✖ Mul',
  division: '➗ Div',
  tables: '📋 Tables',
  form_the_question: '✏ Form Q',
  teacher_input: '👨‍🏫 Teacher',
  teacher_day: '🌟 Special',
  two_steps: '📋 2 Steps',
  cracking: '✏ Cracking',
  bodmas: '🧮 Bodmas',
  power_exercise: '⚡ Power',
}

export default function DayCard({ dayNumber, registrationDate, dayRecord, isDemo, horizontal }) {
  const navigate = useNavigate()
  const { student } = useAuth()
  const dayDate = getDayDate(registrationDate, dayNumber)
  const today = isDayToday(registrationDate, dayNumber)
  const past = isDayPast(registrationDate, dayNumber)

  // Check if all expected sections are marked 'done' in section_data
  const normalizeLevel0 = (raw) => {
    if (!raw) return 'l1'
    const low = raw.toLowerCase()
    if (/^l[1-8]$/.test(low)) return low
    if (/^[1-8]$/.test(low)) return `l${low}`
    const map = { beginner: 'l1', elementary: 'l2', intermediate: 'l3', advanced: 'l4', expert: 'l5' }
    return map[low] || 'l1'
  }
  const _level = normalizeLevel0(student?.level)
  const _expectedSecs = (LEVEL_SECTIONS[_level] || ['abacus']).filter(s => s !== 'teacher_input')
  if (_level !== 'l1' && isDemo) {
    _expectedSecs.push('power_exercise')
  }
  const _sectionData = dayRecord?.section_data || {}
  const allSectionsDone = _expectedSecs.length > 0 &&
    _expectedSecs.every(s => _sectionData[s]?.status === 'done')

  let status = 'future'
  if (dayRecord?.completed || allSectionsDone) {
    status = 'completed'
  } else if (isDemo) {
    status = 'today'
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
  const normalizeLevel = (raw) => {
    if (!raw) return 'l1'
    const low = raw.toLowerCase()
    if (/^l[1-8]$/.test(low)) return low
    if (/^[1-8]$/.test(low)) return `l${low}`
    const map = { beginner: 'l1', elementary: 'l2', intermediate: 'l3', advanced: 'l4', expert: 'l5' }
    return map[low] || 'l1'
  }
  const studentLevel = normalizeLevel(student?.level)
  const defaultSecs = [...(LEVEL_SECTIONS[studentLevel] || ['abacus'])]
  if (studentLevel !== 'l1' && isDemo) {
    defaultSecs.push('power_exercise')
  }
  const recordedSecs = dayRecord?.section_data ? Object.keys(dayRecord.section_data) : []
  const sections = [...defaultSecs]
  recordedSecs.forEach(sec => {
    if (!sections.includes(sec)) {
      sections.push(sec)
    }
  })
  const sectionData = dayRecord?.section_data || {}

  if (horizontal) {
    return (
      <div className={`day-card-container horizontal ${status}`} style={{ display: 'flex', gap: '2rem', padding: '2rem', background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.08), rgba(0, 212, 170, 0.05))', borderRadius: 'var(--radius-lg)', border: '1px solid var(--primary)', position: 'relative', overflow: 'hidden' }}>
        {/* Left Side */}
        <div className="day-card-left" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px solid var(--border)', paddingRight: '2rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="day-card-title" style={{ fontSize: '1.8rem' }}>Demo Day</h2>
              <span className={`day-card-badge badge-${status}`}>
                {cfg.badge}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              Test your skills on this sample set before you start your actual abacus 100 days challenge.
            </p>
            <div className="day-card-tags" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {sections.map(sec => (
                <span key={sec} className="day-card-tag-pill">
                  {SECTION_SHORT_LABELS[sec] || sec}
                </span>
              ))}
            </div>
          </div>

          <button 
            className={`day-card-footer ${cfg.btnClass}`}
            onClick={handleStartResume}
            style={{ marginTop: '2rem', padding: '0.8rem' }}
          >
            <span className="footer-icon">{cfg.icon}</span>
            Start Practice
          </button>
        </div>

        {/* Right Side */}
        <div className="day-card-right" style={{ flex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: 600 }}>📋 PRACTICE SECTIONS</h3>
          <div className="day-card-sections-list" style={{ flexGrow: 0, marginBottom: 0 }}>
            {sections.map((sec, idx) => {
              const secStatus = sectionData[sec]?.status || 'not_started'
              const isSecDone = secStatus === 'done' || dayRecord?.completed
              
              return (
                <div key={sec} className="day-card-section-row" style={{ margin: 0, padding: '1rem' }}>
                  <div className="day-card-section-meta" style={{ marginBottom: '0.5rem' }}>
                    <span className="day-card-section-index">Part {idx + 1}</span>
                    {isSecDone && (
                      <span className="day-card-section-badge done">
                        DONE
                      </span>
                    )}
                  </div>
                  <div className="day-card-section-name" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                    {SECTION_LABELS[sec] || sec}
                  </div>
                  <button 
                    className={`btn-solve-section ${isSecDone ? 'completed-btn' : ''}`}
                    onClick={() => handleSolveSection(sec)}
                    disabled={!clickable || isSecDone}
                    style={isSecDone ? { backgroundColor: 'var(--success)', color: 'white', borderColor: 'var(--success)', pointerEvents: 'none' } : {}}
                  >
                    {isSecDone ? 'Completed ✓' : 'Solve Part →'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`day-card-container ${status}`}>
      {/* Top Header Row */}
      <div className="day-card-header">
        <h2 className="day-card-title">{isDemo ? 'Demo Day' : `Day ${dayNumber}`}</h2>
        <span className={`day-card-badge badge-${status}`}>
          {status === 'completed' ? '✓ ' : status === 'future' ? '🔒 ' : ''}
          {cfg.badge}
        </span>
      </div>

      {/* Date label */}
      {!isDemo && <div className="day-card-date-label">{formatDate(dayDate)}</div>}

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
                    DONE {sectionData[sec]?.marks !== undefined ? `(${sectionData[sec].marks} marks)` : ''}
                  </span>
                )}
              </div>
              <div className="day-card-section-name">
                {SECTION_LABELS[sec] || sec}
              </div>
              <button 
                className={`btn-solve-section ${isSecDone ? 'completed-btn' : ''}`}
                onClick={() => handleSolveSection(sec)}
                disabled={!clickable || isSecDone}
                style={isSecDone ? { backgroundColor: 'var(--success)', color: 'white', borderColor: 'var(--success)', pointerEvents: 'none' } : {}}
              >
                {isSecDone ? 'Completed ✓' : 'Solve Part →'}
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
