import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDayToday } from '../utils/dateUtils'
import { getFormUrl, isFormConfigured } from '../utils/formsConfig'
import api from '../utils/api'
import toast from 'react-hot-toast'
import './DayModal.css'

/**
 * Flow:
 * 1. Verify this day is TODAY and not already opened/completed.
 * 2. Show a "Ready?" confirmation — opening consumes the one-time link.
 * 3. Mark day "opened" on backend → render embedded Google Form.
 * 4. Student clicks "I've submitted" → backend marks completed.
 *
 * Note on cross-origin form submission detection:
 * Google Forms iframes are cross-origin, so we cannot read their DOM or
 * detect submission via JS. The "I've submitted" button is the authoritative
 * completion signal. For automated confirmation, wire a Google Apps Script
 * onFormSubmit trigger to POST to /api/webhooks/form-submit (see README).
 */
export default function DayModal() {
  const { dayNumber } = useParams()
  const dayNum = parseInt(dayNumber, 10)
  const { student } = useAuth()
  const navigate = useNavigate()

  const [phase, setPhase] = useState('checking') // checking|blocked|confirm|form|submitted|error
  const [blockReason, setBlockReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const loadCountRef = useRef(0)

  const formUrl = getFormUrl(student?.level, dayNum)
  const formReady = isFormConfigured(student?.level, dayNum)

  useEffect(() => {
    let mounted = true
    async function check() {
      if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 100) {
        setPhase('error')
        return
      }
      const today = isDayToday(student.registrationDate, dayNum)
      try {
        const res = await api.get(`/students/${student._id}/progress/${dayNum}`)
        if (!mounted) return
        const record = res.data || null

        if (record?.completed) {
          setPhase('submitted')
          return
        }
        if (record?.opened && today) {
          setBlockReason('opened-today')
          setPhase('blocked')
          return
        }
        if (record?.opened && !today) {
          setBlockReason('opened-past')
          setPhase('blocked')
          return
        }
        if (!today) {
          setBlockReason('wrong-day')
          setPhase('blocked')
          return
        }
        setPhase('confirm')
      } catch {
        if (!mounted) return
        toast.error('Could not load this day. Please try again.')
        setPhase('error')
      }
    }
    check()
    return () => { mounted = false }
  }, [dayNum, student])

  const handleStart = async () => {
    setSubmitting(true)
    try {
      await api.post(`/students/${student._id}/progress/${dayNum}/open`)
      setPhase('form')
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not start this day.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCheckVerification = async () => {
    setSubmitting(true)
    try {
      const res = await api.get(`/students/${student._id}/progress/${dayNum}`)
      if (res.data?.completed) {
        setPhase('submitted')
        toast.success('Day marked complete! Great work 🎉')
      } else {
        toast.error('We have not received your submission yet. Please wait a few seconds and try again, or make sure you submitted the form.')
      }
    } catch {
      toast.error('Could not verify status. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => navigate('/challenge')

  /* ── Checking spinner ── */
  if (phase === 'checking') {
    return (
      <div className="day-modal-overlay">
        <div className="day-modal-loading"><div className="spinner" /></div>
      </div>
    )
  }

  /* ── Error ── */
  if (phase === 'error') {
    return (
      <div className="day-modal-overlay" onClick={handleClose}>
        <div className="day-modal-card animate-pop" onClick={e => e.stopPropagation()}>
          <div className="day-modal-icon day-modal-icon--warn">⚠</div>
          <h2 className="day-modal-title">Something went wrong</h2>
          <p className="day-modal-text">We couldn't load Day {dayNum}. Please go back and try again.</p>
          <button className="btn btn-primary" onClick={handleClose}>Back to Challenge</button>
        </div>
      </div>
    )
  }

  /* ── Blocked ── */
  if (phase === 'blocked') {
    const messages = {
      'opened-today': {
        title: 'Already opened today',
        text: `You've already opened Day ${dayNum}'s questionnaire. Each day can only be accessed once. If you haven't submitted the form yet, please do so from the tab where you opened it.`,
      },
      'opened-past': {
        title: 'Missed — not submitted',
        text: `You opened Day ${dayNum}'s challenge but didn't submit it in time. The link is now permanently locked. Keep going with today's challenge to rebuild your streak!`,
      },
      'wrong-day': {
        title: 'Day not available',
        text: `Day ${dayNum} is either in the future or has already passed. Each day's challenge is only accessible on its specific day.`,
      },
    }
    const cfg = messages[blockReason] || messages['wrong-day']
    return (
      <div className="day-modal-overlay" onClick={handleClose}>
        <div className="day-modal-card animate-pop" onClick={e => e.stopPropagation()}>
          <div className="day-modal-icon day-modal-icon--warn">🔒</div>
          <h2 className="day-modal-title">{cfg.title}</h2>
          <p className="day-modal-text">{cfg.text}</p>
          <button className="btn btn-primary" onClick={handleClose}>Back to Challenge</button>
        </div>
      </div>
    )
  }

  /* ── Completed ── */
  if (phase === 'submitted') {
    return (
      <div className="day-modal-overlay" onClick={handleClose}>
        <div className="day-modal-card animate-pop" onClick={e => e.stopPropagation()}>
          <div className="day-modal-icon day-modal-icon--done">✓</div>
          <h2 className="day-modal-title">Day {dayNum} Complete!</h2>
          <p className="day-modal-text">
            Excellent work! Come back tomorrow for Day {dayNum + 1}.
          </p>
          <button className="btn btn-primary" onClick={handleClose}>Back to Challenge</button>
        </div>
      </div>
    )
  }

  /* ── Confirmation gate ── */
  if (phase === 'confirm') {
    return (
      <div className="day-modal-overlay" onClick={handleClose}>
        <div className="day-modal-card animate-pop" onClick={e => e.stopPropagation()}>
          <div className="day-modal-icon day-modal-icon--ready">🧮</div>
          <h2 className="day-modal-title">Ready for Day {dayNum}?</h2>
          <p className="day-modal-text">
            This link can only be opened <strong>once</strong>. Make sure you're
            focused and have enough time — once you start, you cannot reopen it.
          </p>
          {!formReady && (
            <div className="day-modal-warn-banner">
              ⚠ This day's form hasn't been configured yet. Contact your teacher.
            </div>
          )}
          <div className="day-modal-actions">
            <button className="btn btn-ghost" onClick={handleClose} disabled={submitting}>
              Not yet
            </button>
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={submitting || !formReady}
            >
              {submitting ? 'Starting…' : "I'm ready →"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Form embed ── */
  return (
    <div className="day-modal-overlay day-modal-overlay--form">
      <div className="day-modal-form-card animate-pop">
        <div className="day-modal-form-header">
          <div className="day-modal-form-header-left">
            <h3>Day {dayNum} Questionnaire</h3>
            <span className="badge badge-amber">In Progress — submit before midnight</span>
          </div>
          <button className="day-modal-close-btn" onClick={handleClose} title="Back to challenge">✕</button>
        </div>

        <div className="day-modal-iframe-wrap">
          <iframe
            src={formUrl}
            title={`Day ${dayNum} Challenge Form`}
            onLoad={() => { loadCountRef.current += 1 }}
            className="day-modal-iframe"
            allow="camera; microphone"
          />
        </div>

        <div className="day-modal-form-footer">
          <p className="day-modal-form-hint">
            Submitted the form above? Our system verifies it automatically. If it doesn't close on its own, you can manually check the status.
          </p>
          <button
            className="btn btn-primary"
            onClick={handleCheckVerification}
            disabled={submitting}
          >
            {submitting ? 'Checking…' : "Check Verification Status"}
          </button>
        </div>
      </div>
    </div>
  )
}
