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
  
  // Sub-second precision for the shrinking bar
  const [msElapsed, setMsElapsed] = useState(0)
  const [answerFeedback, setAnswerFeedback] = useState(null)

  const formReady = isFormConfigured(student?.level, dayNum)

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
    if (answerFeedback) return // prevent double submission during feedback

    const elapsedMs = Date.now() - questionStart
    const timeSec = elapsedMs / 1000
    const timeTaken = Math.floor(timeSec)
    const currentQ = questions[currentIndex]
    
    // Evaluate answer
    let isCorrect = true
    if (currentQ.computedAnswer !== null && currentQ.computedAnswer !== undefined) {
      if (currentQ.type === 'steps') {
        const normalize = (str) => String(str).toLowerCase().replace(/\s+/g, '')
        isCorrect = normalize(currentAnswer) === normalize(currentQ.computedAnswer)
      } else {
        isCorrect = parseFloat(currentAnswer.trim()) === parseFloat(currentQ.computedAnswer)
      }
    }

    setAnswerFeedback(isCorrect ? 'correct' : 'incorrect')
    
    // XP Calculation
    let xpGained = 0
    if (isCorrect) {
      xpGained = calculateXp(timeSec)
      setLastXpGained(xpGained)
      setTotalXp(prev => prev + xpGained)
      setShowXpAnim(true)
      setTimeout(() => setShowXpAnim(false), 800)
    }

    const newAnswers = [...answers, {
      questionId: currentQ.id,
      entryId: currentQ.entryId,
      value: currentAnswer.trim(),
      isCorrect,
      isMath: currentQ.computedAnswer !== null && currentQ.computedAnswer !== undefined,
      computedAnswer: currentQ.computedAnswer,
      title: currentQ.title
    }]
    
    const newTimes = [...questionTimes, {
      questionId: currentQ.id,
      timeTaken
    }]

    setAnswers(newAnswers)
    setQuestionTimes(newTimes)

    setTimeout(() => {
      setAnswerFeedback(null)
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1)
        setCurrentAnswer('')
        setQuestionStart(Date.now())
        setMsElapsed(0)
      } else {
        submitTest(newAnswers, newTimes, totalXp + xpGained)
      }
    }, 600)
  }

  const submitTest = async (finalAnswers, finalTimes, finalXp) => {
    setPhase('submitting')
    setLoadingMsg('Evaluating your speed & syncing...')
    const totalTimeSeconds = finalTimes.reduce((acc, curr) => acc + curr.timeTaken, 0)
    setTotalTime(totalTimeSeconds)

    const mathAnswers = finalAnswers.filter(a => a.isMath)
    const correctAnswers = mathAnswers.filter(a => a.isCorrect)
    const accuracy = mathAnswers.length > 0 ? Math.round((correctAnswers.length / mathAnswers.length) * 100) : 0

    try {
      await api.post(`/students/${student.id}/progress/${dayNum}/submit`, {
        submitUrl,
        answers: finalAnswers,
        questionTimes: finalTimes,
        totalTimeSeconds,
        xpEarned: finalXp,
        accuracy
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
              style={{ width: `${100 - timerPct}%`, backgroundColor: timerColor }}
            />
          </div>
          
          <div className="test-body">
            <div className="test-question-box">
              {renderQuestionTitle(currentQ.title)}
            </div>
            
            {currentQ.formatExample && (
              <div style={{ color: '#a37ba8', fontSize: '13px', marginBottom: '8px', textAlign: 'center' }}>
                Format example: {currentQ.formatExample}
              </div>
            )}

            <input
              type="text"
              className={`test-input ${answerFeedback ? 'feedback-' + answerFeedback : ''}`}
              autoFocus
              disabled={!!answerFeedback}
              placeholder="Your answer..."
              value={currentAnswer}
              onChange={e => setCurrentAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNext()}
            />
          </div>

          <div className="test-footer">
            <button className="btn btn-primary btn-block" onClick={handleNext} disabled={!!answerFeedback}>
              {currentIndex === questions.length - 1 ? 'Submit Test' : 'Next Question →'}
            </button>
          </div>
        </div>
      </div>
    )
  }


  if (phase === 'summary') {
    const mathAnswers = answers.filter(a => a.isMath);
    const correctCount = mathAnswers.filter(a => a.isCorrect).length;
    const incorrectCount = mathAnswers.length - correctCount;
    const accuracy = mathAnswers.length > 0 ? Math.round((correctCount / mathAnswers.length) * 100) : 0;
    
    // Calculate Streak
    let longestStreak = 0;
    let currentStreak = 0;
    mathAnswers.forEach(a => {
      if (a.isCorrect) {
        currentStreak++;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    });

    const avgTime = mathAnswers.length > 0 ? Math.round(totalTime / mathAnswers.length) : 0;

    return (
      <div className="day-modal-overlay day-modal-overlay--form quiz-summary-overlay">
        <div className="quiz-summary-container animate-pop">
          
          {/* Header Card */}
          <div className="quiz-header-card">
            <div className="quiz-header-content">
              <h1 className="quiz-header-title">{student.name}'s Mastery</h1>
              <p className="quiz-header-subtitle">🎉 Your Progress Matters!</p>
              
              <div className="quiz-header-stats">
                <div className="quiz-header-rank">
                  <span className="quiz-rank-value">15</span><span className="quiz-rank-total">/19</span>
                  <div className="quiz-rank-label">Rank ⟳</div>
                </div>
                <div className="quiz-header-score">
                  <span className="quiz-score-value">{totalXp}</span>
                  <div className="quiz-score-label">Score</div>
                </div>
              </div>

              <div className="quiz-header-actions">
                <button className="btn-quiz btn-quiz-outline" onClick={() => window.location.reload()}>Play Again</button>
                <button className="btn-quiz btn-quiz-primary" onClick={handleClose}>Return to Dashboard</button>
              </div>
            </div>
            
            <div className="quiz-avatar-section">
              <img src={'https://api.dicebear.com/7.x/bottts/svg?seed=' + student.name} alt="Avatar" className="quiz-avatar-img" />
              <button className="btn-quiz btn-quiz-white">Shop</button>
            </div>
          </div>

          {/* Accuracy & Performance */}
          <div className="quiz-metrics-grid">
            
            <div className="quiz-accuracy-card">
              <h3 className="quiz-card-title">Accuracy ℹ</h3>
              <div className="quiz-accuracy-timeline">
                <div className="quiz-accuracy-scale">
                  <span>100%</span><span>80%</span><span>60%</span><span>40%</span><span>20%</span><span>0%</span>
                </div>
                <div className="quiz-accuracy-plot">
                  <div className="quiz-accuracy-point" style={{ bottom: `${accuracy}%` }}>
                    <div className="quiz-accuracy-tooltip">{accuracy}%</div>
                  </div>
                  <div className="quiz-accuracy-label">This attempt</div>
                </div>
              </div>
            </div>

            <div className="quiz-performance-card">
              <div className="quiz-perf-header">
                <h3 className="quiz-card-title">Performance Stats</h3>
                <span className="quiz-perf-total">{mathAnswers.length} questions</span>
              </div>
              <div className="quiz-perf-pills">
                <div className="quiz-pill pill-correct">✓ {correctCount} Correct</div>
                <div className="quiz-pill pill-incorrect">✕ {incorrectCount} Incorrect</div>
                <div className="quiz-pill pill-time">⏱ {avgTime} s time/question</div>
                <div className="quiz-pill pill-streak">🔥 {longestStreak} Streak</div>
              </div>
            </div>

          </div>

          {/* Review Questions */}
          <div className="quiz-review-section">
            <div className="quiz-review-header">
              <div>
                <h3 className="quiz-card-title">Review Questions</h3>
                <p className="quiz-review-subtitle">Click on the questions to see answers</p>
              </div>
              <button className="btn-quiz btn-quiz-white">Study Flashcards</button>
            </div>
            
            <div className="quiz-review-list">
              {mathAnswers.map((ans, i) => (
                <div key={i} className={`quiz-review-item ${ans.isCorrect ? 'item-correct' : 'item-incorrect'}`}>
                  <div className="review-item-number">{i + 1}.</div>
                  <div className="review-item-content">
                    <div className="review-item-title">{ans.title.split('\n').map((l, j) => <div key={j}>{l}</div>)}</div>
                    <div className="review-item-answers">
                      <div className={`review-answer user-answer ${ans.isCorrect ? 'text-correct' : 'text-incorrect'}`}>
                        Your answer: {ans.value}
                      </div>
                      {!ans.isCorrect && (
                        <div className="review-answer correct-answer text-correct">
                          Correct answer: {ans.computedAnswer}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
