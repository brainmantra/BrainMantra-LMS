import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getChallengeDay } from '../utils/dateUtils'
import { LEVELS } from '../utils/formsConfig'
import api from '../utils/api'
import DayCard from '../components/DayCard'
import StreakCorner from '../components/StreakCorner'
import toast from 'react-hot-toast'
import './ChallengePage.css'

export default function ChallengePage() {
  const { student, logout } = useAuth()
  const navigate = useNavigate()
  const [days, setDays] = useState([]) // array of day records from backend
  const [streak, setStreak] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)
  const [loading, setLoading] = useState(true)

  const levelInfo = LEVELS.find(l => l.id === student?.level)
  const currentDay = useMemo(() => getChallengeDay(student?.registration_date), [student])
  const clampedCurrentDay = Math.min(currentDay, 100)
  const maxRenderDay = Math.min(currentDay + 1, 100)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const res = await api.get(`/students/${student.id}/progress`)
        if (!mounted) return
        setDays(res.data.days || [])
        setStreak(res.data.streak ?? 0)
        setLongestStreak(res.data.longestStreak ?? 0)
      } catch (err) {
        toast.error('Could not load your progress. Showing offline view.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    if (student?.id) load()
    return () => { mounted = false }
  }, [student])

  const dayMap = useMemo(() => {
    const m = {}
    days.forEach(d => { m[d.dayNumber] = d })
    return m
  }, [days])

  const completedCount = days.filter(d => d.completed).length

  if (currentDay > 100) {
    return (
      <div className="page-wrapper">
        <div className="container" style={{ paddingTop: 80, textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: 12 }}>🎉 Challenge Complete!</h1>
          <p style={{ color: 'var(--slate)' }}>You've finished all 100 days. Incredible work, {student.name.split(' ')[0]}!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrapper">
      <header className="challenge-header">
        <div className="container challenge-header-inner">
          <div className="challenge-brand">
            <svg width="32" height="32" viewBox="0 0 52 52" fill="none">
              <rect width="52" height="52" rx="14" fill="#f5a623"/>
              <circle cx="19" cy="15.5" r="5" fill="#1a2340"/>
              <circle cx="29" cy="26" r="5" fill="#1a2340"/>
              <circle cx="22" cy="36.5" r="5" fill="#1a2340"/>
            </svg>
            <span className="challenge-brand-text">100 Days of Abacus</span>
          </div>
          <nav className="challenge-nav">
            <button className="btn btn-ghost" onClick={() => navigate('/leaderboard')}>🏆 Leaderboard</button>
            <button className="btn btn-ghost" onClick={() => { logout(); navigate('/') }}>Log out</button>
          </nav>
        </div>
      </header>

      <div className="container challenge-body">
        <section className="challenge-intro animate-fade">
          <div>
            <h1 className="challenge-title">Hey {student.name.split(' ')[0]} 👋</h1>
            <p className="challenge-subtitle">
              <span className="badge badge-amber">{levelInfo?.label || student.level}</span>
              {' '}You're on Day <strong>{clampedCurrentDay}</strong> of 100.
            </p>
          </div>
          <div className="challenge-progress-ring">
            <svg width="74" height="74" viewBox="0 0 74 74">
              <circle cx="37" cy="37" r="32" fill="none" stroke="var(--ivory-dark)" strokeWidth="7" />
              <circle
                cx="37" cy="37" r="32" fill="none" stroke="var(--amber)" strokeWidth="7"
                strokeDasharray={2 * Math.PI * 32}
                strokeDashoffset={2 * Math.PI * 32 * (1 - completedCount / 100)}
                strokeLinecap="round"
                transform="rotate(-90 37 37)"
              />
            </svg>
            <span className="challenge-progress-label">{completedCount}/100</span>
          </div>
        </section>

        <section className="animate-fade" style={{ animationDelay: '0.05s', marginBottom: 28 }}>
          <StreakCorner streak={streak} longestStreak={longestStreak} />
        </section>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : (
          <section className="day-grid animate-fade" style={{ animationDelay: '0.1s' }}>
            {Array.from({ length: maxRenderDay }, (_, i) => i + 1).map(dayNum => (
              <DayCard
                key={dayNum}
                dayNumber={dayNum}
                registrationDate={student.registration_date}
                dayRecord={dayMap[dayNum]}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
