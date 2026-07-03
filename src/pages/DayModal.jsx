import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isDayToday } from '../utils/dateUtils'
import { isFormConfigured } from '../utils/formsConfig'
import api from '../utils/api'
import toast from 'react-hot-toast'
import confetti from 'canvas-confetti'
import './DayModal.css'

const SECONDS_PER_QUESTION = 15;
const MAX_XP_PER_QUESTION = 1000;

export default function DayModal() {
  const { dayNumber } = useParams()
  const dayNum = parseInt(dayNumber, 10)
  const { student } = useAuth()
  const navigate = useNavigate()

  const [phase, setPhase] = useState('checking') 
  const [blockReason, setBlockReason] = useState('')
  const [loadingMsg, setLoadingMsg] = useState('')
  
  // Test State
  const [questions, setQuestions] = useState([])
  const [submitUrl, setSubmitUrl] = useState('')
  const [countdown, setCountdown] = useState(3)
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [questionTimes, setQuestionTimes] = useState([])
  const [questionStart, setQuestionStart] = useState(0)
  
  const [totalTime, setTotalTime] = useState(0)
  const [totalXp, setTotalXp] = useState(0)
  const [lastXpGained, setLastXpGained] = useState(0)
  const [showXpAnim, setShowXpAnim] = useState(false)
  
  // UI Timer for current question
  const [uiTimer, setUiTimer] = useState(0)
  // Sub-second precision for the shrinking bar
  const [msElapsed, setMsElapsed] = useState(0)

  const formReady = isFormConfigured(student?.level, dayNum)

  useEffect(() => {
    let mounted = true
    async function check() {
      if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 100) {
        setPhase('error')
        return
      }
      const today = isDayToday(student.registration_date, dayNum)
      try {
        const res = await api.get(`/students/${student.id}/progress/${dayNum}`)
        if (!mounted) return
        const record = res.data || null

        if (record?.completed) {
          setPhase('submitted')
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

  // Timer interval for test phase
  useEffect(() => {
    let interval;
    if (phase === 'test') {
      interval = setInterval(() => {
        const elapsed = Date.now() - questionStart
        setMsElapsed(elapsed)
        setUiTimer(Math.floor(elapsed / 1000))
      }, 50) // 50ms for smooth progress bar
    }
    return () => clearInterval(interval)
  }, [phase, questionStart])

  const handleStart = async () => {
    setPhase('fetching')
    setLoadingMsg('Preparing your questions...')
    try {
      await api.post(`/students/${student.id}/progress/${dayNum}/open`)
      const qRes = await api.get(`/students/${student.id}/progress/${dayNum}/questions`)
      setQuestions(qRes.data.questions)
      setSubmitUrl(qRes.data.submitUrl)
      startCountdown()
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not load questions.'
      toast.error(msg)
      setPhase('confirm')
    }
  }

  const startCountdown = () => {
    setPhase('countdown')
    setCountdown(3)
    let c = 3
    const iv = setInterval(() => {
      c--
      if (c > 0) {
        setCountdown(c)
      } else if (c === 0) {
        setCountdown('GO!')
      } else {
        clearInterval(iv)
        startTest()
      }
    }, 1000)
  }

  const startTest = () => {
    setCurrentIndex(0)
    setAnswers([])
    setQuestionTimes([])
    setCurrentAnswer('')
    setTotalXp(0)
    setQuestionStart(Date.now())
    setPhase('test')
  }

  const calculateXp = (timeSec) => {
    if (timeSec >= SECONDS_PER_QUESTION) return 100; // Minimum points
    const ratio = (SECONDS_PER_QUESTION - timeSec) / SECONDS_PER_QUESTION;
    return 100 + Math.round(ratio * (MAX_XP_PER_QUESTION - 100));
  }

  const handleNext = async () => {
    if (!currentAnswer.trim()) {
      toast.error('Please enter an answer.')
      return
    }

    const elapsedMs = Date.now() - questionStart
    const timeSec = elapsedMs / 1000
    const timeTaken = Math.floor(timeSec)
    const currentQ = questions[currentIndex]
    
    // XP Calculation
    const xpGained = calculateXp(timeSec)
    setLastXpGained(xpGained)
    setTotalXp(prev => prev + xpGained)
    
    // Trigger XP animation
    setShowXpAnim(true)
    setTimeout(() => setShowXpAnim(false), 800)

    const newAnswers = [...answers, {
      questionId: currentQ.id,
      entryId: currentQ.entryId,
      value: currentAnswer.trim()
    }]
    
    const newTimes = [...questionTimes, {
      questionId: currentQ.id,
      timeTaken
    }]

    setAnswers(newAnswers)
    setQuestionTimes(newTimes)

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setCurrentAnswer('')
      setQuestionStart(Date.now())
      setMsElapsed(0)
      setUiTimer(0)
    } else {
      submitTest(newAnswers, newTimes)
    }
  }

  const submitTest = async (finalAnswers, finalTimes) => {
    setPhase('submitting')
    setLoadingMsg('Evaluating your speed & syncing...')
    const totalTimeSeconds = finalTimes.reduce((acc, curr) => acc + curr.timeTaken, 0)
    setTotalTime(totalTimeSeconds)

    try {
      await api.post(`/students/${student.id}/progress/${dayNum}/submit`, {
        submitUrl,
        answers: finalAnswers,
        questionTimes: finalTimes,
        totalTimeSeconds
      })
      setPhase('summary')
    } catch (err) {
      toast.error('Could not submit test. Please try again.')
      setPhase('error')
    }
  }

  const handleClose = () => navigate('/challenge')

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const renderQuestionTitle = (title) => {
    return title.split('\n').map((line, i) => (
      <div key={i}>{line}</div>
    ))
  }

  /* ── Progress Bar Logic ── */
  const getTimerColor = (pct) => {
    if (pct > 75) return '#ef4444'; // Red
    if (pct > 50) return '#f5a623'; // Yellow
    return '#10b981'; // Green
  }
  const timeLimitMs = SECONDS_PER_QUESTION * 1000
  const timerPct = Math.min(100, (msElapsed / timeLimitMs) * 100)
  const timerColor = getTimerColor(timerPct)

  /* ── Overlays ── */
  if (phase === 'checking' || phase === 'fetching' || phase === 'submitting') {
    return (
      <div className="day-modal-overlay">
        <div className="day-modal-loading-card animate-pop">
          <div className="spinner" style={{ marginBottom: 15 }} />
          <h3>{loadingMsg || 'Loading...'}</h3>
        </div>
      </div>
    )
  }

  if (phase === 'countdown') {
    return (
      <div className="day-modal-overlay">
        <div className="countdown-number animate-pop-scale">{countdown}</div>
      </div>
    )
  }

  if (phase === 'test') {
    const currentQ = questions[currentIndex]
    return (
      <div className="day-modal-overlay day-modal-overlay--form">
        <div className="day-modal-test-card animate-pop">
          
          <div className="test-header">
            <div className="test-progress-pill">
              <span className="q-label">Question {currentIndex + 1}</span>
              <span className="q-total">/ {questions.length}</span>
            </div>
            <div className="test-xp-pill">
              <span>{totalXp} XP</span>
              {showXpAnim && <div className="xp-float-anim">+{lastXpGained}</div>}
            </div>
          </div>
          
          <div className="test-timer-bar-wrap">
            <div 
              className="test-timer-bar-fill" 
              style={{ width: \`\${100 - timerPct}%\`, backgroundColor: timerColor }}
            />
          </div>
          
          <div className="test-body">
            <div className="test-question-box">
              {renderQuestionTitle(currentQ.title)}
            </div>
            <input
              type="text"
              className="test-input"
              autoFocus
              placeholder="Your answer..."
              value={currentAnswer}
              onChange={e => setCurrentAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNext()}
            />
          </div>

          <div className="test-footer">
            <button className="btn btn-primary btn-block" onClick={handleNext}>
              {currentIndex === questions.length - 1 ? 'Submit Test' : 'Next Question →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Trigger confetti when entering summary phase
  useEffect(() => {
    if (phase === 'summary') {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [phase]);

  if (phase === 'summary') {
    return (
      <div className="day-modal-overlay day-modal-overlay--form">
        <div className="day-modal-test-card animate-pop" style={{ height: 'auto', maxHeight: '90vh' }}>
          
          <div className="summary-header">
            <div className="summary-icon">🏆</div>
            <h2 className="summary-title">Challenge Complete!</h2>
            <div className="summary-xp-total">{totalXp} XP Earned</div>
          </div>
          
          <div className="test-body summary-body">
            <div className="summary-stats-grid">
              <div className="summary-stat-card">
                <div className="stat-card-label">Total Time</div>
                <div className="stat-card-value">{formatTime(totalTime)}</div>
              </div>
              <div className="summary-stat-card">
                <div className="stat-card-label">Avg Speed</div>
                <div className="stat-card-value">{formatTime(Math.round(totalTime / questions.length))} /q</div>
              </div>
            </div>
            
            <h4 className="summary-subtitle">Speed Breakdown</h4>
            <div className="summary-list">
              {questionTimes.map((qt, i) => (
                <div key={i} className="summary-list-item">
                  <span>Question {i + 1}</span>
                  <span style={{ color: qt.timeTaken > SECONDS_PER_QUESTION ? '#ef4444' : '#10b981' }}>
                    {formatTime(qt.timeTaken)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="test-footer">
            <button className="btn btn-primary btn-block" onClick={handleClose}>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

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

  if (phase === 'blocked') {
    const messages = {
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

  if (phase === 'confirm') {
    return (
      <div className="day-modal-overlay" onClick={handleClose}>
        <div className="day-modal-card animate-pop" onClick={e => e.stopPropagation()}>
          <div className="day-modal-icon day-modal-icon--ready">⚡</div>
          <h2 className="day-modal-title">Ready for Day {dayNum}?</h2>
          <p className="day-modal-text">
            Answer as fast as you can to earn maximum Speed XP! You have 15 seconds for bonus XP on each question.
          </p>
          {!formReady && (
            <div className="day-modal-warn-banner">
              ⚠ This day's test hasn't been configured yet. Contact your teacher.
            </div>
          )}
          <div className="day-modal-actions">
            <button className="btn btn-ghost" onClick={handleClose}>
              Not yet
            </button>
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={!formReady}
            >
              Start Game →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
