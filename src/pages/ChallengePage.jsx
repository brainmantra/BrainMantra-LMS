import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StudentLayout from '../components/StudentLayout'
import { getChallengeDay } from '../utils/dateUtils'
import { LEVELS } from '../utils/formsConfig'
import api from '../utils/api'
import DayCard from '../components/DayCard'
import StreakCorner from '../components/StreakCorner'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Joyride, STATUS } from 'react-joyride'
import './ChallengePage.css'

export default function ChallengePage() {
  const { student, logout } = useAuth()
  const navigate = useNavigate()
  const [days, setDays] = useState([]) // array of day records from backend
  const [streak, setStreak] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('map') // 'map' or 'dashboard'

  const LEVEL_LABELS = {
    beginner: 'Beginner',
    l1: 'Level 1', l2: 'Level 2', l3: 'Level 3', l4: 'Level 4',
    l5: 'Level 5', l6: 'Level 6', l7: 'Level 7', l8: 'Level 8',
    alumni: 'Alumni', gm: 'Grand Master (GM)'
  }

  const [{ run, steps }, setTourState] = useState({
    run: false,
    steps: [
      {
        target: '.tour-step-progress',
        content: 'This shows your overall completion out of 100 days. Keep going!',
        disableBeacon: true,
      },
      {
        target: '.tour-step-streak',
        content: 'Here you can see your current streak. Solve everyday to keep it going!',
      },
      {
        target: '.tour-step-demo',
        content: 'This is the Demo Day. You can practice here as many times as you like without affecting your streak!',
      },
      {
        target: '.tour-step-dashboard',
        content: 'Click here to switch to your dashboard and view your performance statistics.',
      }
    ]
  })

  // Start tour automatically if not seen
  useEffect(() => {
    if (student?.id) {
      const hasSeenTour = localStorage.getItem(`tour_seen_${student.id}`)
      if (!hasSeenTour) {
        // slight delay to let elements render
        setTimeout(() => setTourState(prev => ({ ...prev, run: true })), 500)
      }
    }
  }, [student])

  const handleJoyrideCallback = (data) => {
    const { status } = data
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED]
    if (finishedStatuses.includes(status)) {
      localStorage.setItem(`tour_seen_${student.id}`, 'true')
      setTourState(prev => ({ ...prev, run: false }))
    }
  }

  const startTourManually = () => {
    setTourState(prev => ({ ...prev, run: true }))
  }

  const currentDay = useMemo(() => getChallengeDay(student?.first_login_date || student?.registration_date), [student])
  const clampedCurrentDay = Math.min(currentDay, 100)
  const maxRenderDay = Math.min(currentDay, 100)

  const stats = useMemo(() => {
    const completedDaysList = days.filter(d => d.completed)
    const totalAccuracy = completedDaysList.reduce((acc, d) => acc + parseFloat(d.accuracy || 0), 0)
    const avgAccuracy = completedDaysList.length > 0 ? Math.round(totalAccuracy / completedDaysList.length) : 0
    
    const totalTime = completedDaysList.reduce((acc, d) => acc + (d.time_taken_seconds || 0), 0)
    const avgTime = completedDaysList.length > 0 ? Math.round(totalTime / completedDaysList.length) : 0

    return {
      completedCount: completedDaysList.length,
      avgAccuracy,
      totalTime,
      avgTime,
    }
  }, [days])

  const chartData = useMemo(() => {
    return days
      .filter(d => d.completed)
      .map(d => ({
        day: `Day ${d.day_number}`,
        Accuracy: parseFloat(d.accuracy || 0),
        Time: Math.round((d.time_taken_seconds || 0) / 60 * 10) / 10, // in minutes
      }))
  }, [days])

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
    days.forEach(d => { m[d.day_number] = d })
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
    <StudentLayout>
      <Joyride
        callback={handleJoyrideCallback}
        continuous
        hideCloseButton
        run={run}
        scrollToFirstStep
        showProgress
        showSkipButton
        steps={steps}
        styles={{
          options: {
            primaryColor: '#f5a623',
            zIndex: 10000,
          }
        }}
      />

      <div className="container challenge-body" style={{ padding: 0, maxWidth: '100%' }}>
        <section className="challenge-intro animate-fade" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="challenge-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span>Hey {student.name.split(' ')[0]} 👋</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={startTourManually}
                title="Replay page tour"
                style={{ fontSize: '0.8rem', padding: '3px 10px', border: '1px solid var(--border)', borderRadius: '6px' }}
              >
                Replay Tour ℹ️
              </button>
            </h1>
            <p className="challenge-subtitle">
              <span className="badge badge-amber">{LEVEL_LABELS[student?.level] || student?.level}</span>
              {' '}You're on Day <strong>{clampedCurrentDay}</strong> of 100.
            </p>
          </div>
          <div className="challenge-progress-ring tour-step-progress">
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

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
          <button 
            className={`btn ${activeTab === 'map' ? 'btn-primary' : 'btn-ghost'}`} 
            style={{ fontSize: '0.9rem', padding: '0.4rem 1rem' }}
            onClick={() => setActiveTab('map')}
          >
            🗺️ Challenge Map
          </button>
          <button 
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'} tour-step-dashboard`} 
            style={{ fontSize: '0.9rem', padding: '0.4rem 1rem' }}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 My Dashboard
          </button>
        </div>

        {activeTab === 'map' ? (
          <>
            <section className="animate-fade tour-step-streak" style={{ animationDelay: '0.05s', marginBottom: 28 }}>
              <StreakCorner streak={streak} longestStreak={longestStreak} />
            </section>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                <div className="spinner" />
              </div>
            ) : (
              <>
                {/* Horizontal Demo Day Card */}
                <div className="demo-day-horizontal-card-container tour-step-demo" style={{ marginBottom: '2.5rem' }}>
                  <DayCard
                    dayNumber={0}
                    registrationDate={student.first_login_date || student.registration_date}
                    dayRecord={null}
                    isDemo={true}
                    horizontal={true}
                  />
                  <div style={{ 
                    fontSize: '0.85rem', 
                    marginTop: '0.75rem', 
                    textAlign: 'center', 
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    background: 'rgba(108, 99, 255, 0.05)',
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(108, 99, 255, 0.15)',
                    color: 'var(--primary-light)'
                  }}>
                    <span>🗓️</span> Your challenge starts from 15th July 2026
                  </div>
                </div>

                {/* Challenge Day Grid */}
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', fontWeight: 600 }}>🗺️ CHALLENGE MAP</h3>
                <section className="day-grid animate-fade" style={{ animationDelay: '0.1s' }}>
                  {Array.from({ length: maxRenderDay }, (_, i) => i + 1).map((dayNum, index) => (
                    <div key={dayNum}>
                      <DayCard
                        dayNumber={dayNum}
                        registrationDate={student.first_login_date || student.registration_date}
                        dayRecord={dayMap[dayNum]}
                        isDemo={false}
                      />
                    </div>
                  ))}
                </section>
              </>
            )}
          </>
        ) : (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
              <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>⚡</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{student?.xp_total || 0} XP</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total XP</div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>✅</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{stats.completedCount}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Days Completed</div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🔥</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff5722' }}>{streak} Days</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Current Streak</div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🎯</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-light)' }}>{stats.avgAccuracy}%</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Avg Accuracy</div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>⏱</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-teal)' }}>{Math.round(stats.totalTime / 60)} m</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Time Spent</div>
              </div>
            </div>

            {/* Charts Row */}
            {chartData.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-primary)' }}>Accuracy Trend (%)</h3>
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="day" stroke="var(--text-secondary)" fontSize={10} />
                        <YAxis domain={[0, 100]} stroke="var(--text-secondary)" fontSize={10} />
                        <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                        <Line type="monotone" dataKey="Accuracy" stroke="var(--primary-light)" strokeWidth={2} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-primary)' }}>Time Spent Trend (Minutes)</h3>
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="day" stroke="var(--text-secondary)" fontSize={10} />
                        <YAxis stroke="var(--text-secondary)" fontSize={10} />
                        <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                        <Line type="monotone" dataKey="Time" stroke="var(--success)" strokeWidth={2} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Complete days to populate dashboard charts!
              </div>
            )}

            {/* Recent Day Completions Table */}
            <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Completed Days History</h3>
              {days.filter(d => d.completed).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No completed days yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Day</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Accuracy</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>XP Earned</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Marks</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>Time Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.filter(d => d.completed).map(d => (
                        <tr key={d.day_number} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ fontWeight: 'bold', padding: '0.75rem 1rem' }}>Day {d.day_number}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ 
                              color: d.accuracy >= 90 ? 'var(--success)' : d.accuracy >= 70 ? 'var(--accent-gold)' : 'var(--error)',
                              fontWeight: '600'
                            }}>
                              {d.accuracy}%
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>+{d.xp_earned} XP</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{d.total_marks} marks</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{Math.floor(d.time_taken_seconds / 60)}m {d.time_taken_seconds % 60}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  )
}
