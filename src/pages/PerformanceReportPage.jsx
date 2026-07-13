import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import confetti from 'canvas-confetti'

const SECTION_LABELS = {
  abacus: '🧮 Abacus', visual: '👁 Visual',
  multiplication: '✖ Multiplication', division: '➗ Division',
  tables: '📋 Tables', form_the_question: '✏ Form The Question',
  teacher_input: '👨‍🏫 Teacher Section', teacher_day: '🌟 Special Day',
}

function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${String(sec).padStart(2, '0')}s`
}

export default function PerformanceReportPage() {
  const { dayNumber } = useParams()
  const dayNum = parseInt(dayNumber, 10)
  const { student } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(null)

  useEffect(() => {
    let mounted = true
    api.get(`/students/${student.id}/progress/${dayNum}/report`)
      .then(res => { if (mounted) { setReport(res.data); setLoading(false) } })
      .catch(() => { setLoading(false) })
    return () => { mounted = false }
  }, [dayNum, student])

  useEffect(() => {
    if (report) {
      confetti({ particleCount: 160, spread: 80, origin: { y: 0.5 } })
      setTimeout(() => confetti({ particleCount: 80, spread: 50, origin: { y: 0.4, x: 0.2 } }), 600)
      setTimeout(() => confetti({ particleCount: 80, spread: 50, origin: { y: 0.4, x: 0.8 } }), 1200)
    }
  }, [report])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading your report...</p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 380, margin: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <h3>Report not available</h3>
          <p style={{ color: 'var(--text-muted)', margin: '1rem 0 1.5rem' }}>Complete and submit the paper to see your report.</p>
          <button className="btn btn-primary" onClick={() => navigate('/challenge')}>Back to Challenge</button>
        </div>
      </div>
    )
  }

  const { day, responses, student: st } = report
  const sectionData = day.section_data || {}
  const sections = Object.keys(sectionData)

  // Group responses by section
  const bySection = {}
  responses.forEach(r => {
    if (!bySection[r.section_name]) bySection[r.section_name] = []
    bySection[r.section_name].push(r)
  })

  const totalQs = responses.length
  const totalCorrect = responses.filter(r => r.is_correct).length
  const accuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0
  const avgTime = totalQs > 0 ? Math.round((day.time_taken_seconds || 0) / totalQs) : 0

  const formatDisplayAnswer = (val) => {
    if (!val) return ''
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed.join(' ➔ ')
    } catch (e) {}
    return String(val)
  }

  return (
    <div className="page page-bg-dots" style={{ paddingBottom: '4rem' }}>

      {/* Hero header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(0,212,170,0.15), rgba(245,200,66,0.1))',
        borderBottom: '1px solid var(--border)',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem', animation: 'float 3s ease-in-out infinite' }}>🏆</div>
        <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
          Day {dayNum} Report
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
          {st?.name} · {student?.level?.toUpperCase().replace('L', 'Level ')}
        </p>

        {/* Key metrics */}
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '1rem', maxWidth: 600, margin: '0 auto' }}>
          {[
            { label: 'Total Marks',   val: day.total_marks ?? 0,   icon: '📝', color: 'var(--primary-light)' },
            { label: 'Accuracy',      val: `${accuracy}%`,          icon: '🎯', color: 'var(--success)' },
            { label: 'Total XP',      val: `+${day.xp_earned ?? 0}`,icon: '⚡', color: 'var(--accent-gold)' },
            { label: 'Total Time',    val: formatTime(day.time_taken_seconds ?? 0), icon: '⏱', color: 'var(--info)' },
            { label: 'Avg/Question',  val: `${avgTime}s`,           icon: '⚡', color: 'var(--accent-teal)' },
          ].map((m, i) => (
            <div key={i} className="report-metric" style={{ minWidth: 100, flex: '1 1 90px' }}>
              <div style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>{m.icon}</div>
              <div className="report-metric__val" style={{ color: m.color, fontSize: '1.6rem' }}>{m.val}</div>
              <div className="report-metric__label">{m.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/challenge')}>
            ← Back to Challenge
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/leaderboard')}>
            🏅 View Leaderboard
          </button>
        </div>
      </div>

      <div className="container-md" style={{ padding: '2rem 1rem' }}>

        {/* Section breakdown */}
        {sections.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>📊 Section Breakdown</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <thead>
                  <tr>
                    <th>Section</th><th>Questions</th><th>Correct</th>
                    <th>Marks</th><th>Accuracy</th><th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map(sec => {
                    const sd = sectionData[sec] || {}
                    const secAcc = sd.questionCount > 0 ? Math.round((sd.correct / sd.questionCount) * 100) : 0
                    return (
                      <tr key={sec}>
                        <td style={{ fontWeight: 600 }}>{SECTION_LABELS[sec] || sec}</td>
                        <td>{sd.questionCount ?? 0}</td>
                        <td>
                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>{sd.correct ?? 0}</span>
                          <span style={{ color: 'var(--text-muted)' }}> / {sd.questionCount ?? 0}</span>
                        </td>
                        <td><span className="badge badge-primary">{sd.marks ?? 0}</span></td>
                        <td>
                          <span style={{ color: secAcc >= 80 ? 'var(--success)' : secAcc >= 50 ? 'var(--warning)' : 'var(--error)', fontWeight: 600 }}>
                            {secAcc}%
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{formatTime(sd.timeTaken ?? 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Per-question review */}
        {sections.map(sec => {
          const secResponses = bySection[sec] || []
          if (!secResponses.length) return null
          return (
            <div key={sec} style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                {SECTION_LABELS[sec] || sec}
              </h3>
              {secResponses.map((r, i) => (
                <div key={i} className={`review-item review-item--${r.is_correct === true ? 'correct' : r.is_correct === false ? 'incorrect' : 'pending'}`} style={r.is_correct === null ? { borderLeft: '4px solid var(--warning)', background: 'rgba(245,200,66,0.06)' } : {}}>
                  <div style={{
                    minWidth: 32, height: 32,
                    borderRadius: '50%',
                    background: r.is_correct === true ? 'var(--success-bg)' : r.is_correct === false ? 'var(--error-bg)' : 'rgba(245,200,66,0.15)',
                    border: `2px solid ${r.is_correct === true ? 'var(--success)' : r.is_correct === false ? 'var(--error)' : 'var(--warning)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: r.is_correct === true ? 'var(--success)' : r.is_correct === false ? 'var(--error)' : 'var(--warning)',
                    fontWeight: 700, fontSize: '0.9rem',
                  }}>
                    {r.is_correct === true ? '✓' : r.is_correct === false ? '✗' : '⏳'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      {r.question_snapshot}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                      <span style={{ color: r.is_correct === true ? 'var(--success)' : r.is_correct === false ? 'var(--error)' : 'var(--warning)' }}>
                        Your answer: <strong>{formatDisplayAnswer(r.student_answer) || '(no answer)'}</strong>
                      </span>
                      {r.is_correct === null && (
                        <span style={{ color: 'var(--warning)' }}>
                          ⏳ <em>Pending review by teacher</em>
                        </span>
                      )}
                      <span style={{ color: 'var(--text-muted)' }}>⏱ {r.time_taken_seconds}s</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        {responses.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            No detailed response data available.
          </div>
        )}
      </div>
    </div>
  )
}
