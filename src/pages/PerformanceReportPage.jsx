import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StudentLayout from '../components/StudentLayout'
import api from '../utils/api'
import confetti from 'canvas-confetti'
import toast from 'react-hot-toast'

const SECTION_LABELS = {
  abacus: '🧮 Abacus', 
  bead_fun: '🧮 Bead Fun',
  activity: '⚡ Activity',
  visual: '👁 Visual',
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
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareImageUrl, setShareImageUrl] = useState('')

  useEffect(() => {
    if (report && !shareImageUrl) {
      // Auto open share modal on load
      setShowShareModal(true)

      // Draw the certificate image in Canvas
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 500
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Background Gradient
      const gradient = ctx.createLinearGradient(0, 0, 800, 500)
      gradient.addColorStop(0, '#0a0d16')
      gradient.addColorStop(0.5, '#121727')
      gradient.addColorStop(1, '#070a10')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 800, 500)

      // Floating Neon Orbs decoration
      ctx.fillStyle = 'rgba(255, 122, 0, 0.05)'
      ctx.beginPath()
      ctx.arc(100, 100, 150, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = 'rgba(0, 180, 216, 0.04)'
      ctx.beginPath()
      ctx.arc(700, 400, 180, 0, Math.PI * 2)
      ctx.fill()

      // Double borders
      ctx.strokeStyle = 'rgba(255, 122, 0, 0.3)'
      ctx.lineWidth = 4
      ctx.strokeRect(20, 20, 760, 460)

      ctx.strokeStyle = 'rgba(245, 200, 66, 0.5)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(26, 26, 748, 448)

      // Add corner accents
      const corners = [
        [26, 26, 40, 40],
        [774, 26, -40, 40],
        [26, 474, 40, -40],
        [774, 474, -40, -40]
      ]
      ctx.fillStyle = '#f5c842'
      corners.forEach(([x, y, w, h]) => {
        ctx.fillRect(x, y, w, 4)
        ctx.fillRect(x, y, 4, h)
      })

      // Title header
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '800 13px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.letterSpacing = '5px'
      ctx.fillText('BRAIN MANTRA ABACUS ACADEMY', 400, 70)

      // Challenge completion label
      ctx.fillStyle = '#f5c842'
      ctx.font = '900 36px system-ui, sans-serif'
      ctx.fillText(`DAY ${dayNum} COMPLETED!`, 400, 150)

      // Congratulates
      ctx.fillStyle = '#94a3b8'
      ctx.font = 'italic 16px Georgia, serif'
      ctx.fillText('This certificate is proudly awarded to', 400, 205)

      // Student Name
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 32px Georgia, serif'
      ctx.fillText(report.student?.name || 'Abacus Champion', 400, 255)

      // Horizontal glow line
      const lineGrad = ctx.createLinearGradient(250, 0, 550, 0)
      lineGrad.addColorStop(0, 'transparent')
      lineGrad.addColorStop(0.5, 'rgba(255, 122, 0, 0.6)')
      lineGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = lineGrad
      ctx.fillRect(250, 275, 300, 2)

      // Description text
      ctx.fillStyle = '#94a3b8'
      ctx.font = '15px system-ui, sans-serif'
      ctx.fillText(`for outstanding performance in the 100 Days of Abacus Challenge.`, 400, 310)

      // Stats cards
      const totalCorrect = report.responses?.filter(r => r.is_correct).length || 0
      const totalQs = report.responses?.length || 0
      const accuracyVal = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0

      const statsList = [
        { label: 'ACCURACY', val: `${accuracyVal}%` },
        { label: 'XP EARNED', val: `+${report.day?.xp_earned || 0} XP` },
        { label: 'STREAK', val: `${student?.streak || 1} Days` }
      ]
      
      statsList.forEach((stat, idx) => {
        const startX = 200 + idx * 200
        
        // Draw stat box
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)'
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
        ctx.lineWidth = 1
        ctx.beginPath()
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(startX - 80, 340, 160, 65, 8)
        } else {
          ctx.rect(startX - 80, 340, 160, 65)
        }
        ctx.fill()
        ctx.stroke()

        // Stat value
        ctx.fillStyle = idx === 0 ? '#10b981' : idx === 1 ? '#f5c842' : '#ff7a00'
        ctx.font = 'bold 20px system-ui, sans-serif'
        ctx.fillText(stat.val, startX, 370)

        // Stat label
        ctx.fillStyle = '#64748b'
        ctx.font = 'bold 10px system-ui, sans-serif'
        ctx.fillText(stat.label, startX, 390)
      })

      // Footer
      ctx.fillStyle = '#64748b'
      ctx.font = 'italic 12px Georgia, serif'
      ctx.fillText('"Every bead is a step towards greatness"', 400, 445)

      // Convert to image URL
      setShareImageUrl(canvas.toDataURL('image/png'))
    }
  }, [report, dayNum, student])

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
    <StudentLayout>
      <div className="container-md" style={{ padding: 0, maxWidth: '100%' }}>
        {/* Hero header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(108,99,255,0.1), rgba(0,212,170,0.08))',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          marginBottom: '1.5rem'
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
          <button className="btn btn-primary btn-sm" onClick={() => setShowShareModal(true)} style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-bright))' }}>
            🎉 Share Progress
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
                        <td style={{ fontWeight: 600 }}>{sd.label || SECTION_LABELS[sec] || sec}</td>
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
          const sd = sectionData[sec] || {}
          return (
            <div key={sec} style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                {sd.label || SECTION_LABELS[sec] || sec}
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

      {/* Dynamic Progress Share Modal */}
      {showShareModal && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowShareModal(false)}
          style={{ zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
        >
          <div 
            className="card animate-pop" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: '640px', width: '100%', margin: '1rem', padding: '2rem', textAlign: 'center', background: 'rgba(15,20,32,0.95)', border: '1px solid rgba(255,122,0,0.3)', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <h2 style={{ fontSize: '1.4rem', color: 'var(--primary-bright)', marginBottom: '0.25rem' }}>
              🎉 Day {dayNum} Complete!
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              Awesome job completing today's challenge. Here is your personalized progress certificate! Save it or share it directly to social media and tag <strong>Brain Mantra</strong>.
            </p>

            {/* Display Generated Certificate Image */}
            {shareImageUrl ? (
              <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                <img 
                  src={shareImageUrl} 
                  alt="Day Complete Certificate" 
                  style={{ width: '100%', borderRadius: '12px', border: '1.5px solid rgba(255,122,0,0.25)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} 
                />
              </div>
            ) : (
              <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', marginBottom: '1.5rem', border: '1px dashed var(--border)' }}>
                <div className="spinner" />
              </div>
            )}

            {/* Sharing Block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `🎉 I just completed Day ${dayNum} of the 100 Days Abacus Challenge at Brain Mantra with ${accuracy}% accuracy! 🧮 Join me at @brainmantra`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-whatsapp"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', height: '44px', fontSize: '0.9rem', borderRadius: '10px' }}
              >
                💬 Share on WhatsApp
              </a>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `I just completed Day ${dayNum} of the 100 Days Abacus Challenge with ${accuracy}% accuracy! 🧮 Tagging @brainmantra`
                    )
                    toast.success('Instagram tag text copied! Share your story & tag @brainmantra.')
                  }}
                  className="btn btn-ghost"
                  style={{ border: '1.5px solid rgba(255,255,255,0.1)', height: '44px', fontSize: '0.85rem', justifyContent: 'center', borderRadius: '10px' }}
                >
                  📸 Copy Instagram Tag
                </button>

                {shareImageUrl && (
                  <a
                    href={shareImageUrl}
                    download={`BrainMantra_Day_${dayNum}_Progress.png`}
                    className="btn btn-ghost"
                    style={{ textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', fontSize: '0.85rem', color: 'var(--text-primary)', borderRadius: '10px' }}
                  >
                    📥 Save to Device
                  </a>
                )}
              </div>

              <button
                onClick={() => setShowShareModal(false)}
                className="btn btn-ghost btn-sm"
                style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  )
}
