import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import StudentLayout from '../components/StudentLayout'
import { getChallengeDay } from '../utils/dateUtils'
import { LEVELS } from '../utils/formsConfig'
import api from '../utils/api'
import DayCard from '../components/DayCard'
import StreakCorner from '../components/StreakCorner'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import './ChallengePage.css'

export default function ChallengePage() {
  const { student } = useAuth()
  const [days, setDays] = useState([])
  const [streak, setStreak] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('map')

  const LEVEL_LABELS = {
    beginner: 'Beginner',
    l1: 'Level 1', l2: 'Level 2', l3: 'Level 3', l4: 'Level 4',
    l5: 'Level 5', l6: 'Level 6', l7: 'Level 7', l8: 'Level 8',
    alumni: 'Alumni', gm: 'Grand Master (GM)'
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

      <div className="container challenge-body" style={{ padding: 0, maxWidth: '100%' }}>
        <section className="dash-hero animate-fade" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 className="challenge-title" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Hey {student.name.split(' ')[0]} 👋
            </h1>
            <p className="challenge-subtitle" style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-primary badge-3d">{LEVEL_LABELS[student?.level] || student?.level}</span>
              <span style={{ color: 'var(--text-secondary)' }}>You're on Day <strong>{clampedCurrentDay}</strong> of 100.</span>
            </p>
          </div>
          <div className="challenge-progress-ring" style={{ position: 'relative' }}>
            <svg width="74" height="74" viewBox="0 0 74 74" style={{ filter: 'drop-shadow(0 4px 12px rgba(255,122,0,0.25))' }}>
              <circle cx="37" cy="37" r="32" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
              <circle
                cx="37" cy="37" r="32" fill="none" stroke="var(--primary)" strokeWidth="6"
                strokeDasharray={2 * Math.PI * 32}
                strokeDashoffset={2 * Math.PI * 32 * (1 - completedCount / 100)}
                strokeLinecap="round"
                transform="rotate(-90 37 37)"
              />
            </svg>
            <span className="challenge-progress-label" style={{ fontWeight: 800, color: 'var(--text-primary)', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{completedCount}/100</span>
          </div>
        </section>

        {/* Tab Switcher */}
        <div className="tabs" style={{ marginBottom: '2rem' }}>
          <button 
            className={`tab ${activeTab === 'map' ? 'active' : ''}`} 
            onClick={() => setActiveTab('map')}
          >
            🗺️ Challenge Map
          </button>
          <button 
            className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`} 
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
              <>
                {/* Horizontal Demo Day Card */}
                <div className="demo-day-horizontal-card-container" style={{ marginBottom: '2.5rem' }}>
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
            {/* Stats Row - responsive to sidebar state */}
            <div className="stats-grid">
              <style>{`
                /* Sidebar open: 3 cols then 2 cols (5 cards) */
                [data-sidebar='open'] .stats-grid {
                  grid-template-columns: repeat(3, 1fr);
                }
                /* Sidebar closed: single row of 5 */
                [data-sidebar='closed'] .stats-grid {
                  grid-template-columns: repeat(5, 1fr);
                }
                /* Default fallback (auto) */
                .stats-grid {
                  display: grid;
                  gap: 1rem;
                  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                }
                @media (max-width: 991px) {
                  [data-sidebar='open'] .stats-grid,
                  [data-sidebar='closed'] .stats-grid {
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                  }
                }
              `}</style>
              <div className="stat-card stat-card--gold card-shiny">
                <div className="stat-card__icon">⚡</div>
                <div className="stat-card__value">{student?.xp_total || 0} XP</div>
                <div className="stat-card__label">Total XP</div>
              </div>
              <div className="stat-card stat-card--success card-shiny">
                <div className="stat-card__icon">✅</div>
                <div className="stat-card__value">{stats.completedCount}</div>
                <div className="stat-card__label">Days Completed</div>
              </div>
              <div className="stat-card card-shiny" style={{ '--primary-glow': 'rgba(255,87,34,0.3)' }}>
                <div className="stat-card__icon">🔥</div>
                <div className="stat-card__value" style={{ background: 'linear-gradient(135deg, #ff8a65, #ff5722)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 0 8px rgba(255,87,34,0.3))' }}>{streak} Days</div>
                <div className="stat-card__label">Current Streak</div>
              </div>
              <div className="stat-card card-shiny" style={{ '--primary-glow': 'var(--primary-glow)' }}>
                <div className="stat-card__icon">🎯</div>
                <div className="stat-card__value">{stats.avgAccuracy}%</div>
                <div className="stat-card__label">Avg Accuracy</div>
              </div>
              <div className="stat-card stat-card--teal card-shiny">
                <div className="stat-card__icon">⏱</div>
                <div className="stat-card__value">{Math.round(stats.totalTime / 60)} m</div>
                <div className="stat-card__label">Total Time Spent</div>
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
