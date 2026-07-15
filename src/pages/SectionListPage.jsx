import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StudentLayout from '../components/StudentLayout'
import { isDayToday } from '../utils/dateUtils'
import api from '../utils/api'
import toast from 'react-hot-toast'

const SECTION_ICONS = {
  abacus:            '🧮',
  bead_fun:          '🧮',
  activity:          '⚡',
  visual:            '👁',
  multiplication:    '✖',
  division:          '➗',
  tables:            '📋',
  form_the_question: '✏',
  teacher_input:     '👨‍🏫',
  teacher_day:       '🌟',
  two_steps:         '📋',
  cracking:          '✏',
  bodmas:            '🧮',
  power_exercise:    '⚡',
}

const SECTION_LABELS = {
  abacus:            '🧮 Abacus',
  bead_fun:          '🧮 Bead Fun',
  activity:          '⚡ Activity',
  visual:            '👁 Visual',
  multiplication:    '✖ Multiplication',
  division:          '➗ Division',
  tables:            '📋 Tables',
  form_the_question: '✏ Form The Question',
  teacher_input:     '👨‍🏫 Teacher Section',
  teacher_day:       '🌟 Special Day',
  two_steps:         '📋 Two Steps',
  cracking:          '✏ Cracking',
  bodmas:            '🧮 Bodmas',
  power_exercise:    '⚡ Power Exercise',
}

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', badge: 'badge-muted',   icon: '○' },
  in_progress: { label: 'In Progress', badge: 'badge-warning', icon: '⏳' },
  done:        { label: 'Done ✓',      badge: 'badge-success', icon: '✓' },
}

export default function SectionListPage() {
  const { dayNumber } = useParams()
  const dayNum = parseInt(dayNumber, 10)
  const { student, login } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)          // { sections, paperCompleted, isTeacherDay, teacherDayReady }
  const [submitting, setSubmitting] = useState(false)

  const isToday = dayNum === 0 || (student ? isDayToday(student.registration_date, dayNum) : false)
  const isDemo = dayNum === 0

  // Open day record first, then fetch sections
  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        // Ensure day is opened
        try {
          await api.post(`/students/${student.id}/progress/${dayNum}/open`)
        } catch (e) {
          // 409 = already opened, that's fine; 403 = wrong day
          if (e.response?.status === 403) {
            toast.error(e.response.data.message || 'This day is not available today.')
            navigate('/challenge')
            return
          }
        }

        const res = await api.get(`/students/${student.id}/progress/${dayNum}/sections`)
        if (mounted) setData(res.data)
      } catch (err) {
        toast.error('Could not load sections. Please try again.')
        navigate('/challenge')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [dayNum, student, navigate])

  const visibleSections = data.sections?.filter(sec => sec.questionCount > 0) || []
  const allDone = visibleSections.every(s => s.status === 'done') && visibleSections.length > 0

  const handleSubmitPaper = async () => {
    if (!allDone) return
    setSubmitting(true)
    try {
      const res = await api.post(`/students/${student.id}/progress/${dayNum}/submit`)
      if (res.data && res.data.streakBonus) {
        login({ ...student, xp_total: (student.xp_total || 0) + res.data.streakBonus })
      }
      navigate(`/challenge/day/${dayNum}/report`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit paper.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePlaySection = (sec) => {
    if (sec.status === 'done' && !isDemo) {
      toast('This section is already completed.', { icon: '✓' })
      return
    }
    if (!isToday && !data?.paperCompleted) {
      toast.error('This day is no longer available.')
      return
    }
    navigate(`/challenge/day/${dayNum}/sections/${sec.section}`)
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading your paper...</p>
      </div>
    )
  }

  if (!data) return null

  // Paper already completed → show report button
  if (data.paperCompleted) {
    return (
      <StudentLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', width: '100%' }}>
          <div className="card animate-pop" style={{ maxWidth: 420, width: '100%', margin: '2rem', textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
            <h2 className="gradient-text" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Day {dayNum} Complete!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>You've already submitted this paper.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate(`/challenge/day/${dayNum}/report`)}>
                View Report
              </button>
              <button className="btn btn-ghost" onClick={() => navigate('/challenge')}>
                Back to Challenge
              </button>
            </div>
          </div>
        </div>
      </StudentLayout>
    )
  }

  const levelLabel = student?.level?.toUpperCase().replace('L', 'Level ')

  return (
    <StudentLayout>
      <div className="container-md" style={{ padding: 0, maxWidth: '100%' }}>
        {/* Header Header Info Panel */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(0,212,170,0.06))',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginBottom: '1rem' }}
              onClick={() => navigate('/challenge')}
            >
              ← Back
            </button>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
                {isDemo ? '🎮 Demo Day' : `Day ${dayNum}`}
              </h1>
              {isDemo ? (
                <p style={{ color: 'var(--warning)', fontWeight: 600, fontSize: '0.9rem' }}>
                  💡 Practice mode — your progress here won’t affect your streak or score!
                </p>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  {levelLabel} • {visibleSections.length} section{visibleSections.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            {allDone && (
              <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
                All sections complete!
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="container-md" style={{ padding: '2rem 1.5rem' }}>

        {/* Every-5th-day teacher not ready */}
        {data.isTeacherDay && !data.teacherDayReady && (
          <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
            <span>⏳</span>
            <div>
              <strong>Today's question is being prepared by your teacher.</strong>
              <br />Please check back shortly.
            </div>
          </div>
        )}

        {/* Progress summary */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {['not_started', 'in_progress', 'done'].map(s => {
            const count = visibleSections.filter(sec => sec.status === s).length || 0
            const cfg = STATUS_CONFIG[s]
            return (
              <span key={s} className={`badge ${cfg.badge}`} style={{ fontSize: '0.8rem', padding: '5px 12px' }}>
                {cfg.icon} {count} {cfg.label}
              </span>
            )
          })}
        </div>

        {/* Section list */}
        <div className="section-list" style={{ marginBottom: '2rem' }}>
          {visibleSections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No questions are available for this day yet.
            </div>
          ) : visibleSections.map((sec) => {
            const isReady = sec.ready !== false
            const statusCfg = isReady ? (STATUS_CONFIG[sec.status] || STATUS_CONFIG.not_started) : { label: 'Teacher preparing...', badge: 'badge-warning', icon: '⏳' }
            const icon = SECTION_ICONS[sec.section] || '📖'
            const isDone = sec.status === 'done'
            const canPlay = isToday && isReady

            return (
              <div
                key={sec.section}
                className={`section-item${isDone ? ' section-item--done' : ''}`}
                style={{ cursor: canPlay && !isDone ? 'pointer' : 'default', opacity: isReady ? 1 : 0.6 }}
                onClick={() => canPlay && !isDone && handlePlaySection(sec)}
              >
                <div className="section-item__left">
                  <div className="section-item__icon">{icon}</div>
                  <div>
                    <div className="section-item__name">{sec.label || SECTION_LABELS[sec.section] || sec.section}</div>
                    <div className="section-item__meta">
                      {isDone
                        ? `✓ ${sec.marks ?? 0} marks · ${sec.timeTaken ?? 0}s`
                        : `${sec.questionCount ?? 5} questions`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`badge ${statusCfg.badge}`}>
                    {statusCfg.label} {isDone ? `(${sec.marks ?? 0} marks)` : ''}
                  </span>
                  {!isDone && canPlay ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={e => { e.stopPropagation(); handlePlaySection(sec) }}
                    >
                      ▶ Solve Part
                    </button>
                  ) : isDone ? (
                    <button
                      className="btn btn-success btn-sm"
                      style={{ pointerEvents: 'none' }}
                      disabled
                    >
                      ✓ Completed
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        {/* Submit Paper - hide for demo */}
        {!isDemo && (
          <div className="card" style={{ textAlign: 'center', padding: '1.5rem 2rem' }}>
            {allDone ? (
              <>
                <p style={{ color: 'var(--success)', fontWeight: 600, marginBottom: '1rem' }}>
                  🎉 All sections completed! Submit your paper to see your score.
                </p>
                <button
                  className="btn btn-success btn-lg"
                  onClick={handleSubmitPaper}
                  disabled={submitting}
                >
                  {submitting ? <><div className="spinner spinner-sm" /> Submitting...</> : '📝 Submit Paper'}
                </button>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>
                Complete all sections to unlock paper submission.
              </p>
            )}
          </div>
        )}
        {isDemo && allDone && (
          <div className="card" style={{ textAlign: 'center', padding: '1.5rem 2rem', borderColor: 'var(--success)' }}>
            <p style={{ color: 'var(--success)', fontWeight: 600, marginBottom: '1rem' }}>
              🎉 Great practice! You’ve tried all sections. Head back and start your real challenge!
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/challenge')}>
              Go to Challenge Map
            </button>
          </div>
        )}
        </div>
      </div>
    </StudentLayout>
  )
}
