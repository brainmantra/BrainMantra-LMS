import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LEVELS } from '../utils/formsConfig'
import './WelcomePage.css'

const WELCOME_SECONDS = 10

export default function WelcomePage() {
  const { student } = useAuth()
  const navigate = useNavigate()
  const [secondsLeft, setSecondsLeft] = useState(WELCOME_SECONDS)

  const levelInfo = LEVELS.find(l => l.id === student?.level)

  useEffect(() => {
    if (!student) return
    if (secondsLeft <= 0) {
      navigate('/challenge', { replace: true })
      return
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft, student, navigate])

  const handleSkip = () => navigate('/challenge', { replace: true })

  if (!student) return null

  const progressPct = ((WELCOME_SECONDS - secondsLeft) / WELCOME_SECONDS) * 100

  return (
    <div className="welcome-page">
      <div className="welcome-card animate-pop">
        <div className="welcome-check">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" fill="rgba(39,174,96,0.12)" />
            <circle cx="32" cy="32" r="30" stroke="#27ae60" strokeWidth="2.5" className="welcome-check-ring" />
            <path d="M20 33l8 8 16-18" stroke="#27ae60" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="welcome-check-mark" />
          </svg>
        </div>

        <span className="badge badge-green" style={{ marginBottom: 12 }}>Registration Verified</span>
        <h1 className="welcome-title">Welcome, <span className="welcome-name-highlight">{student.name.split(' ')[0]}</span>! 👋</h1>
        <p className="welcome-subtitle">
          You're all set for the <strong>{levelInfo?.label || student.level}</strong> level.
          Your 100-day journey begins today.
        </p>

        <div className="welcome-progress-track">
          <div className="welcome-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="welcome-countdown">Taking you to your challenge in {secondsLeft}s…</p>

        <button className="btn btn-ghost" onClick={handleSkip}>Skip & go now →</button>
      </div>

      <div className="welcome-beads" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="welcome-bead" style={{ '--i': i }} />
        ))}
      </div>
    </div>
  )
}
