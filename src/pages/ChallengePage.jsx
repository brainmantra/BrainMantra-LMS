import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import StudentLayout from '../components/StudentLayout'
import { getChallengeDay } from '../utils/dateUtils'
import { LEVELS } from '../utils/formsConfig'
import api from '../utils/api'
import DayCard from '../components/DayCard'
import StreakCorner from '../components/StreakCorner'
import toast from 'react-hot-toast'
import { calculateAchievements } from '../utils/achievements'
import './ChallengePage.css'

export default function ChallengePage() {
  const { student } = useAuth()
  const [days, setDays] = useState([])
  const [streak, setStreak] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedBadge, setSelectedBadge] = useState(null)

  const achievements = useMemo(() => calculateAchievements(days, streak, longestStreak), [days, streak, longestStreak])

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
    let totalTime = 0
    let totalQs = 0
    let totalCorrect = 0

    days.forEach(d => {
      if (d.section_data) {
        try {
          const sd = typeof d.section_data === 'string' ? JSON.parse(d.section_data) : d.section_data
          Object.values(sd).forEach(sec => {
            if (sec && sec.status === 'done') {
              totalTime += (sec.timeTaken || 0)
              totalCorrect += (sec.correct || 0)
              totalQs += (sec.questionCount || 0)
            }
          })
        } catch (e) {}
      }
    })

    const completedDaysList = days.filter(d => d.completed && d.day_number > 0)
    const avgAccuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0
    const avgTime = completedDaysList.length > 0 ? Math.round(totalTime / completedDaysList.length) : 0

    return {
      completedCount: completedDaysList.length,
      avgAccuracy,
      totalTime,
      avgTime,
    }
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
    if (student?.id) {
      load()
    }
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
              <circle cx="37" cy="37" r="32" fill="none" stroke="var(--border)" strokeWidth="6" />
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

        {/* Streak Counter Header */}
        <section className="animate-fade" style={{ marginBottom: '2rem' }}>
          <StreakCorner streak={streak} longestStreak={longestStreak} />
        </section>

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



          {/* Badges & Achievements Section */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.25rem', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>🏆 Badges & Achievements</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Track your milestones, unlock dynamic abacus badges, and share achievements with friends!</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              {achievements.map(badge => {
                const percent = Math.min((badge.current / badge.target) * 100, 100)
                return (
                  <div 
                    key={badge.id} 
                    className="card-3d"
                    onClick={() => badge.earned && setSelectedBadge(badge)}
                    style={{
                      background: badge.earned ? 'rgba(255,122,0,0.04)' : 'var(--bg-surface)',
                      border: badge.earned ? '1px solid rgba(255,122,0,0.3)' : '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      opacity: badge.earned ? 1 : 0.65,
                      cursor: badge.earned ? 'pointer' : 'default',
                      position: 'relative',
                      boxShadow: badge.earned ? '0 8px 24px rgba(255,122,0,0.15)' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {/* Badge Icon */}
                    <div style={{
                      fontSize: '2.5rem',
                      marginBottom: '0.75rem',
                      filter: badge.earned ? 'drop-shadow(0 0 10px rgba(255,122,0,0.5))' : 'grayscale(100%)',
                      transform: badge.earned ? 'scale(1.05)' : 'scale(0.95)'
                    }}>
                      {badge.icon}
                    </div>
                    
                    {/* Badge Info */}
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.25rem', color: badge.earned ? 'var(--primary-bright)' : 'var(--text-secondary)' }}>
                      {badge.title}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.75rem', minHeight: '34px' }}>
                      {badge.desc}
                    </p>
                    
                    {/* Badge Progress bar */}
                    <div style={{ width: '100%', marginTop: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                        <span>Progress</span>
                        <span>{Math.round(badge.current)} / {badge.target} {badge.unit}</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${percent}%`,
                          height: '100%',
                          background: badge.earned 
                            ? 'linear-gradient(90deg, var(--primary), var(--primary-bright))' 
                            : 'var(--text-muted)',
                          borderRadius: '3px',
                          boxShadow: badge.earned ? '0 0 8px var(--primary)' : 'none'
                        }} />
                      </div>
                    </div>
                    
                    {/* Earned Banner Ribbon */}
                    {badge.earned && (
                      <span style={{
                        position: 'absolute', top: '8px', right: '8px',
                        fontSize: '0.65rem', fontWeight: 800, color: 'var(--success)',
                        background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px'
                      }}>
                        EARNED
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected Badge Share Modal */}
          {selectedBadge && (
            <div 
              className="modal-overlay" 
              onClick={() => setSelectedBadge(null)}
              style={{ zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div 
                className="card animate-pop" 
                onClick={e => e.stopPropagation()} 
                style={{ maxWidth: '440px', width: '100%', margin: '1.5rem', padding: '2.5rem', textAlign: 'center', background: 'rgba(15,20,32,0.95)', border: '1px solid rgba(255,122,0,0.3)', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
              >
                <div style={{ fontSize: '4.5rem', marginBottom: '1rem' }}>
                  {selectedBadge.icon}
                </div>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--primary-bright)', marginBottom: '0.25rem' }}>
                  {selectedBadge.title} Badge!
                </h2>
                <span className="badge badge-success" style={{ marginBottom: '1.5rem' }}>🏆 Milestone Earned</span>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
                  "{selectedBadge.desc}"
                </p>

                {/* Sharing Block */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `🎉 I just unlocked the "${selectedBadge.title}" ${selectedBadge.icon} badge in the 100 Days of Abacus Challenge! 🧮 Learn mental math with me at Brain Mantra! @brainmantra`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-whatsapp"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', height: '48px', fontSize: '0.95rem' }}
                  >
                    💬 Share on WhatsApp
                  </a>
                  
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `I just unlocked the "${selectedBadge.title}" ${selectedBadge.icon} badge in the 100 Days of Abacus Challenge! 🧮 Join me @brainmantra`
                      )
                      toast.success('Instagram tag text copied! Share your story & tag @brainmantra.')
                    }}
                    className="btn btn-ghost"
                    style={{ border: '1.5px solid rgba(255,255,255,0.1)', height: '48px', fontSize: '0.95rem', justifyContent: 'center' }}
                  >
                    📸 Copy Instagram Tag
                  </button>

                  <button
                    onClick={() => setSelectedBadge(null)}
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}
                  >
                    Close Dialog
                  </button>
                </div>
              </div>
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
      </div>
    </StudentLayout>
  )
}
