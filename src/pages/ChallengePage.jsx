import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getChallengeDay } from '../utils/dateUtils'
import { LEVELS } from '../utils/formsConfig'
import api from '../utils/api'
import DayCard from '../components/DayCard'
import StreakCorner from '../components/StreakCorner'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
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
    l1: 'Level 1', l2: 'Level 2', l3: 'Level 3', l4: 'Level 4',
    l5: 'Level 5', l6: 'Level 6', l7: 'Level 7', l8: 'Level 8',
    alumni: 'Alumni'
  }

  const currentDay = useMemo(() => getChallengeDay(student?.registration_date), [student])
  const clampedCurrentDay = Math.min(currentDay, 100)
  const maxRenderDay = Math.min(currentDay + 1, 100)

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
        day: `Day ${d.dayNumber}`,
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
            <button className="btn btn-ghost" onClick={() => { logout(); navigate('/') }}>Log out</button>
          </nav>
        </div>
      </header>

      <div className="container challenge-body">
        <section className="challenge-intro animate-fade">
          <div>
            <h1 className="challenge-title">Hey {student.name.split(' ')[0]} 👋</h1>
            <p className="challenge-subtitle">
              <span className="badge badge-amber">{LEVEL_LABELS[student?.level] || student?.level}</span>
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
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`} 
            style={{ fontSize: '0.9rem', padding: '0.4rem 1rem' }}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 My Dashboard
          </button>
        </div>

        {activeTab === 'map' ? (
          <>
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
                        <tr key={d.dayNumber} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ fontWeight: 'bold', padding: '0.75rem 1rem' }}>Day {d.dayNumber}</td>
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
    </div>
  )
}
