import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import toast from 'react-hot-toast'
import confetti from 'canvas-confetti'
import { checkAnswer, formatAnswer } from '../utils/answerChecker'
import AbacusCard from '../components/AbacusCard'
import SectionTimer, { formatSectionTime } from '../components/SectionTimer'

const SECTION_LABELS = {
  abacus:            '🧮 Abacus',
  visual:            '👁 Visual',
  multiplication:    '✖ Multiplication',
  division:          '➗ Division',
  tables:            '📋 Tables',
  form_the_question: '✏ Form The Question',
  teacher_input:     '👨‍🏫 Teacher Section',
  teacher_day:       '🌟 Special Day',
}

export default function SectionAttemptPage() {
  const { dayNumber, section } = useParams()
  const dayNum = parseInt(dayNumber, 10)
  const { student } = useAuth()
  const navigate = useNavigate()

  const [phase, setPhase] = useState('loading')     // loading|countdown|attempt|submitting|done|error
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [responses, setResponses] = useState([])
  const [feedback, setFeedback] = useState(null)    // null|'correct'|'incorrect'
  const [sectionSeconds, setSectionSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [showXp, setShowXp] = useState(false)
  const [lastXp, setLastXp] = useState(0)
  const [totalXp, setTotalXp] = useState(0)

  const questionStartRef = useRef(Date.now())

  // Open section & fetch questions
  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        // Mark section as opened (one-time)
        try {
          await api.post(`/students/${student.id}/progress/${dayNum}/sections/${section}/open`)
        } catch (e) {
          if (e.response?.status === 409) {
            // Already opened and done — redirect back
            toast('This section is already completed.', { icon: '✓' })
            navigate(`/challenge/day/${dayNum}/sections`)
            return
          }
        }

        const res = await api.get(`/students/${student.id}/progress/${dayNum}/sections/${section}/questions`)
        if (!mounted) return

        if (res.data.teacherNotReady) {
          toast("Today's question isn't ready yet.")
          navigate(`/challenge/day/${dayNum}/sections`)
          return
        }

        setQuestions(res.data.questions || [])
        setPhase('countdown')
      } catch (err) {
        toast.error(err.response?.data?.message || 'Could not load questions.')
        navigate(`/challenge/day/${dayNum}/sections`)
      }
    }
    init()
    return () => { mounted = false }
  }, [dayNum, section, student, navigate])

  // Countdown 3-2-1-GO!
  useEffect(() => {
    if (phase !== 'countdown') return
    let c = 3
    setCountdown(c)
    const iv = setInterval(() => {
      c--
      if (c > 0) setCountdown(c)
      else if (c === 0) setCountdown('GO! 🚀')
      else {
        clearInterval(iv)
        questionStartRef.current = Date.now()
        setTimerRunning(true)
        setPhase('attempt')
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [phase])

  const currentQ = questions[currentIndex]

  const getQuestionType = (q) => {
    return q?.question_type || 'add'
  }

  const buildSnapshot = (q) => {
    const type = getQuestionType(q)
    if (type === 'add' || type === 'visual') {
      const addends = Array.isArray(q.addends) ? q.addends : JSON.parse(q.addends || '[]')
      return addends.map((n, i) => `${i === 0 ? '' : n < 0 ? '− ' : '+ '}${Math.abs(n)}`).join(' ')
    }
    if (type === 'mul_x' || type === 'mul_div' || type === 'two_steps') {
      return `${q.operand1} ${q.operator} ${q.operand2}`
    }
    return q.question_text || q.display_text || ''
  }

  const getQuestionText = (q) => q?.question_text || q?.display_text || ''
  
  const getParsedBlocks = (q) => {
    if (!q) return [];
    const raw = getQuestionText(q);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      throw new Error();
    } catch {
      const parts = raw.split(/\[BOX\]/g);
      if (parts.length === 1) return [{ type: 'text', content: raw }];
      const blocks = [];
      parts.forEach((p, idx) => {
        if (p) blocks.push({ type: 'text', content: p });
        if (idx < parts.length - 1) blocks.push({ type: 'box' });
      });
      return blocks;
    }
  };

  const handleNext = () => {
    const qType = getQuestionType(currentQ);
    if (qType === 'teacher') {
      const blocks = getParsedBlocks(currentQ);
      const boxesCount = blocks.filter(b => b.type === 'box' || b.type === 'step' || b.type === 'paragraph').length;
      let parsed = [];
      try { parsed = JSON.parse(answer); if (!Array.isArray(parsed)) parsed = [answer]; } catch { parsed = [answer]; }
      if (parsed.length < boxesCount || parsed.some(v => !v || !String(v).trim())) {
        toast.error('Please fill in all boxes.');
        return;
      }
    } else {
      if (!String(answer).trim()) {
        toast.error('Please enter an answer.');
        return;
      }
    }
    if (feedback) return  // prevent double submit during animation

    const timeTaken = (Date.now() - questionStartRef.current) / 1000
    const correctAns = currentQ.answer ?? currentQ.computedAnswer ?? currentQ.correct_answer
    const isCorrect = checkAnswer(answer, correctAns, qType)

    setFeedback(isCorrect ? 'correct' : 'incorrect')

    const xp = isCorrect ? 10 : 0
    if (isCorrect) {
      setLastXp(xp)
      setTotalXp(prev => prev + xp)
      setShowXp(true)
      setTimeout(() => setShowXp(false), 900)
    }

    const resp = {
      question_id: currentQ.id,
      question_snapshot: buildSnapshot(currentQ),
      correct_answer: correctAns,
      student_answer: answer.trim(),
      is_correct: isCorrect,
      time_taken_seconds: parseFloat(timeTaken.toFixed(2)),
    }

    const newResponses = [...responses, resp]
    setResponses(newResponses)

    setTimeout(() => {
      setFeedback(null)
      setAnswer('')
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(i => i + 1)
        questionStartRef.current = Date.now()
      } else {
        // Done — submit section
        setTimerRunning(false)
        submitSection(newResponses)
      }
    }, 700)
  }

  const submitSection = async (finalResponses) => {
    setPhase('submitting')
    try {
      await api.post(`/students/${student.id}/progress/${dayNum}/sections/${section}/submit`, {
        responses: finalResponses,
        timeTakenSeconds: sectionSeconds,
      })
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } })
      setPhase('done')
    } catch (err) {
      toast.error('Could not save section. Please try again.')
      setPhase('error')
    }
  }

  /* ── Renders ── */
  if (phase === 'loading') {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading questions...</p>
      </div>
    )
  }

  if (phase === 'countdown') {
    return (
      <div className="modal-overlay">
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '8rem', fontFamily: 'var(--font-display)', fontWeight: 900,
            color: 'var(--primary-light)',
            textShadow: '0 0 60px var(--primary-glow)',
            animation: 'popIn 0.5s ease forwards',
          }}>
            {countdown}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '1rem' }}>
            {SECTION_LABELS[section] || section}
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'submitting') {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Saving your answers...</p>
      </div>
    )
  }

  if (phase === 'done') {
    const correct = responses.filter(r => r.is_correct).length
    const acc = responses.length > 0 ? Math.round((correct / responses.length) * 100) : 0
    return (
      <div className="page page-bg-dots" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card animate-pop" style={{ maxWidth: 420, width: '100%', margin: '2rem', textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>✅</div>
          <h2 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Section Complete!
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {SECTION_LABELS[section]}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div className="report-metric">
              <div className="report-metric__val" style={{ color: 'var(--success)' }}>{correct}</div>
              <div className="report-metric__label">Correct</div>
            </div>
            <div className="report-metric">
              <div className="report-metric__val">{acc}%</div>
              <div className="report-metric__label">Accuracy</div>
            </div>
            <div className="report-metric">
              <div className="report-metric__val" style={{ color: 'var(--accent-gold)' }}>{totalXp}</div>
              <div className="report-metric__label">XP Earned</div>
            </div>
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={() => navigate(`/challenge/day/${dayNum}/sections`)}
          >
            Back to Paper →
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 380, margin: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h3>Something went wrong</h3>
          <p style={{ color: 'var(--text-muted)', margin: '1rem 0 1.5rem' }}>
            Could not save your responses.
          </p>
          <button className="btn btn-primary" onClick={() => navigate(`/challenge/day/${dayNum}/sections`)}>
            Back to Paper
          </button>
        </div>
      </div>
    )
  }

  // ── Attempt phase ──
  if (!currentQ) return null

  const qType = getQuestionType(currentQ)
  const isAddType = qType === 'add' || qType === 'visual'
  const isMulDiv = qType === 'mul_x' || qType === 'mul_div' || qType === 'two_steps'
  const isTeacher = qType === 'teacher'

  const addends = isAddType
    ? (Array.isArray(currentQ.addends) ? currentQ.addends : JSON.parse(currentQ.addends || '[]'))
    : []

  return (
    <div className="page page-bg-dots" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Timer side-effect */}
      <SectionTimer running={timerRunning} onTick={setSectionSeconds} />

      {/* Top bar */}
      <div style={{
        background: 'rgba(10,13,20,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '0.75rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {SECTION_LABELS[section] || section}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Q{currentIndex + 1} / {questions.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* Timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
            ⏱ {formatSectionTime(sectionSeconds)}
          </div>

          {/* XP */}
          <div style={{ position: 'relative' }}>
            <div style={{
              background: 'var(--primary-glow)',
              border: '1px solid var(--primary)',
              borderRadius: 'var(--radius-full)',
              padding: '3px 12px',
              fontSize: '0.85rem', fontWeight: 700,
              color: 'var(--primary-light)',
              fontFamily: 'var(--font-display)',
            }}>
              ⚡ {totalXp} XP
            </div>
            {showXp && (
              <div className="xp-float" style={{ top: '-2rem', left: '50%', transform: 'translateX(-50%)' }}>
                +{lastXp}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: '4px', background: 'var(--border)' }}>
        <div style={{
          height: '100%',
          width: `${((currentIndex) / questions.length) * 100}%`,
          background: 'linear-gradient(90deg, var(--primary), var(--accent-teal))',
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Main question area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>

        {/* Abacus / Visual */}
        {isAddType && (
          <AbacusCard
            questionNum={currentIndex + 1}
            addends={addends}
            value={answer}
            onChange={setAnswer}
            onSubmit={handleNext}
            feedback={feedback}
            disabled={!!feedback}
          />
        )}

        {/* Multiplication / Division */}
        {isMulDiv && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 500 }}>
            {qType === 'two_steps' && (
              <div style={{ 
                background: 'rgba(108, 99, 255, 0.15)', border: '1px solid rgba(108, 99, 255, 0.3)',
                color: 'var(--primary-light)', padding: '0.85rem 1.25rem', borderRadius: '12px', 
                fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center', width: '100%'
              }}>
                <strong>EXAMPLE Answer Format:</strong>
                <br />
                {currentQ.operand2 > 9 ? (
                  <>Question: 13 x 44 = <br /> Answer: 0520 + 052</>
                ) : (
                  <>Question: 13 x 4 = <br /> Answer: 040 + 12</>
                )}
              </div>
            )}
            <div className="mul-card animate-pop" style={{ width: '100%' }}>
              <span className="mul-card__operand">{currentQ.operand1}</span>
              <span className="mul-card__operator">{currentQ.operator}</span>
              <span className="mul-card__operand">{currentQ.operand2}</span>
              <span className="mul-card__eq">=</span>
              <input
                className={`mul-card__input${feedback ? ` ${feedback}` : ''}`}
                type="text"
                placeholder={qType === 'two_steps' ? 'e.g. 040 + 12' : '?'}
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNext()}
                disabled={!!feedback}
                autoFocus
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {/* Teacher / free-text */}
        {isTeacher && (() => {
          const blocks = getParsedBlocks(currentQ);
          let parsedAns = [];
          try { parsedAns = JSON.parse(answer); if(!Array.isArray(parsedAns)) parsedAns = [answer]; } catch { parsedAns = [answer]; }
          let boxIndex = 0;

          return (
            <div className="card animate-pop" style={{ maxWidth: 600, width: '100%', padding: '2rem' }}>
              {currentQ.format_example && (
                <div style={{ 
                  background: 'rgba(163, 123, 168, 0.1)', border: '1px solid rgba(163, 123, 168, 0.3)',
                  color: '#c084fc', padding: '0.5rem 1rem', borderRadius: '8px', 
                  fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center'
                }}>
                  Format example: {currentQ.format_example}
                </div>
              )}
              <div style={{ 
                background: 'var(--bg-elevated)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem',
                lineHeight: 1.6, color: 'var(--text-primary)',
              }}>
                {(() => {
                  let stepIndex = 1;
                  return blocks.map((block, idx) => {
                    if (block.type === 'box' || block.type === 'step' || block.type === 'paragraph') {
                      const currentBoxIdx = boxIndex++;
                      
                      if (block.type === 'paragraph') {
                        return (
                          <textarea
                            key={idx}
                            className={feedback ? `feedback-${feedback}` : ''}
                            style={{
                              width: '100%', minHeight: '100px', display: 'block', margin: '0.75rem 0',
                              padding: '0.5rem', fontSize: '1.1rem', borderRadius: '4px', border: '1px solid var(--border)',
                              background: 'transparent', color: 'var(--text-primary)', resize: 'vertical'
                            }}
                            placeholder="Type your paragraph answer here..."
                            value={parsedAns[currentBoxIdx] || ''}
                            onChange={e => {
                              const newAns = [...parsedAns];
                              newAns[currentBoxIdx] = e.target.value;
                              setAnswer(JSON.stringify(newAns));
                            }}
                            disabled={!!feedback}
                            autoFocus={currentBoxIdx === 0}
                          />
                        );
                      }

                      const inputElem = (
                        <input
                          key={idx}
                          type="text"
                          className={feedback ? `feedback-${feedback}` : ''}
                          style={{
                            width: '100px', textAlign: 'center', display: 'inline-block', margin: '0 0.5rem',
                            padding: '0.3rem', fontSize: '1.1rem', borderRadius: '4px', border: '1px solid var(--border)'
                          }}
                          value={parsedAns[currentBoxIdx] || ''}
                          onChange={e => {
                            const newAns = [...parsedAns];
                            newAns[currentBoxIdx] = e.target.value;
                            setAnswer(JSON.stringify(newAns));
                          }}
                          onKeyDown={e => e.key === 'Enter' && handleNext()}
                          disabled={!!feedback}
                          autoFocus={currentBoxIdx === 0}
                        />
                      );
                      
                      if (block.type === 'step') {
                        return (
                          <div key={idx} style={{ display: 'block', margin: '0.75rem 0', fontWeight: '600' }}>
                            Step {stepIndex++}: {inputElem}
                          </div>
                        );
                      }
                      
                      return inputElem;
                    } else if (block.type === 'instruction') {
                      return (
                        <div key={idx} style={{ 
                          background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '8px', 
                          fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontStyle: 'italic'
                        }}>
                          ℹ️ {block.content}
                        </div>
                      );
                    } else if (block.type === 'options') {
                      const options = (block.content || '').split(',').map(s => s.trim()).filter(Boolean);
                      return (
                        <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '1.5rem 0' }}>
                          {options.map((opt, oIdx) => (
                            <button
                              key={oIdx}
                              className={`btn btn-sm ${parsedAns[0] === opt ? 'btn-primary' : 'btn-ghost'}`}
                              onClick={() => {
                                if (feedback) return;
                                const newAns = [...parsedAns];
                                newAns[0] = opt;
                                setAnswer(JSON.stringify(newAns));
                              }}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      );
                    } else if (block.type === 'example') {
                      return (
                        <div key={idx} style={{ 
                          background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: '8px', 
                          fontSize: '1rem', color: 'var(--success)', marginBottom: '1rem', borderLeft: '3px solid var(--success)'
                        }}>
                          💡 Example: {block.content}
                        </div>
                      );
                    } else {
                      return (
                        <span key={idx} style={{ display: 'inline-block', marginBottom: '1rem', width: '100%' }}>
                          {block.content}
                        </span>
                      );
                    }
                  });
                })()}
              </div>
            </div>
          );
        })()}

        {/* Feedback overlay on card */}
        {feedback && (
          <div style={{
            marginTop: '1rem',
            padding: '0.5rem 1.5rem',
            borderRadius: 'var(--radius-full)',
            background: feedback === 'correct' ? 'var(--success-bg)' : 'var(--error-bg)',
            color: feedback === 'correct' ? 'var(--success)' : 'var(--error)',
            fontWeight: 700, fontSize: '0.95rem',
            animation: 'slideDown 0.2s ease',
          }}>
            {feedback === 'correct' ? '✓ Correct!' : '✗ Wrong!'}
          </div>
        )}

        {/* Next button */}
        <div style={{ marginTop: '1.5rem', width: '100%', maxWidth: 380 }}>
          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={handleNext}
            disabled={!!feedback || !answer.trim()}
          >
            {currentIndex === questions.length - 1 ? '✓ Finish Section' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
