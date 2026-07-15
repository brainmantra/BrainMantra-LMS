import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import toast from 'react-hot-toast'
import confetti from 'canvas-confetti'
import { playBeadClick, playCorrectChime, playIncorrectBuzzer, playFanfare } from '../utils/sound'
import { checkAnswer, formatAnswer } from '../utils/answerChecker'
import AbacusCard from '../components/AbacusCard'
import SectionTimer, { formatSectionTime } from '../components/SectionTimer'

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
}

const isMultiLineRequired = (level, day) => {
  const normLevel = String(level).toLowerCase().trim();
  const dNum = parseInt(day, 10);
  if (normLevel === 'l1' || normLevel === 'beginner') return true;
  if (dNum > 0 && dNum % 5 === 0) return true;
  return false;
};

export default function SectionAttemptPage() {
  const { dayNumber, section } = useParams()
  const dayNum = parseInt(dayNumber, 10)
  const { student, login } = useAuth()
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

  const [currentPageIdx, setCurrentPageIdx] = useState(0)
  const [formAnswers, setFormAnswers] = useState({})
  const [zoomedImage, setZoomedImage] = useState(null)
  const [customSectionTitle, setCustomSectionTitle] = useState('')

  const responsesRef = useRef(responses)
  const sectionSecondsRef = useRef(sectionSeconds)
  const submittingCheatingRef = useRef(false)

  useEffect(() => {
    responsesRef.current = responses
  }, [responses])

  useEffect(() => {
    sectionSecondsRef.current = sectionSeconds
  }, [sectionSeconds])

  const triggerAutosubmit = async () => {
    if (dayNum === 0 || submittingCheatingRef.current) return
    submittingCheatingRef.current = true
    setTimerRunning(false)
    
    toast.error('Anti-cheating triggered: You switched tabs/windows! Your day is autosubmitted.', { duration: 6000 })

    try {
      // 1. Submit current section
      const actualSolveTime = responsesRef.current.reduce((sum, r) => sum + (r.time_taken_seconds || 0), 0)
      await api.post(`/students/${student.id}/progress/${dayNum}/sections/${section}/submit`, {
        responses: responsesRef.current,
        timeTakenSeconds: parseFloat(actualSolveTime.toFixed(2)),
      })
    } catch (e) {
      console.error('Cheating submit section error:', e)
    }

    try {
      // 2. Force submit full paper
      await api.post(`/students/${student.id}/progress/${dayNum}/submit`, { force: true })
    } catch (e) {
      console.error('Cheating submit paper error:', e)
    }

    // 3. Redirect to report
    navigate(`/challenge/day/${dayNum}/report`)
  }

  useEffect(() => {
    if (phase !== 'attempt' || dayNum === 0) return

    const handleAction = () => {
      triggerAutosubmit()
    }

    document.addEventListener('visibilitychange', handleAction)
    window.addEventListener('blur', handleAction)

    return () => {
      document.removeEventListener('visibilitychange', handleAction)
      window.removeEventListener('blur', handleAction)
    }
  }, [phase, dayNum])

  const questionStartRef = useRef(Date.now())

  // Open section & fetch questions
  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        // Mark section as opened (one-time) — skip for demo day
        if (dayNum !== 0) {
          try {
            await api.post(`/students/${student.id}/progress/${dayNum}/sections/${section}/open`)
          } catch (e) {
            if (e.response?.status === 409) {
              // Already opened and done — redirect back
              toast.error(e.response.data.message || 'This section is not available.')
              navigate(isDemo ? '/courses' : `/challenge/day/${dayNum}/sections`, isDemo ? { state: { openDemoDay: true } } : undefined)
              return
            }
          }
        }

        const res = await api.get(`/students/${student.id}/progress/${dayNum}/sections/${section}/questions`)
        if (!mounted) return

        if (res.data.teacherNotReady) {
          toast("Today's question isn't ready yet.")
          navigate(isDemo ? '/courses' : `/challenge/day/${dayNum}/sections`, isDemo ? { state: { openDemoDay: true } } : undefined)
          return
        }

        const rawQs = res.data.questions || []
        const flatQs = []
        rawQs.forEach(q => {
          const qContent = q.question || q.question_text || q.questionText;
          if (qContent) {
            try {
              const parsed = typeof qContent === 'string' ? JSON.parse(qContent) : qContent
              if (parsed && typeof parsed === 'object') {
                if (parsed.title) {
                  const cleaned = parsed.title.startsWith('Daily Challenge - Day') || parsed.title === 'Abacus Daily Challenge'
                    ? ''
                    : parsed.title;
                  setCustomSectionTitle(cleaned)
                }
                if (Array.isArray(parsed.items) && parsed.items.length > 0) {
                  let itemsToRender = parsed.items;
                  // Recover from double-encoded JSON corruption in TeacherDashboard fallback
                  if (itemsToRender.length === 1 && typeof itemsToRender[0].questionText === 'string' && itemsToRender[0].questionText.startsWith('{"title":')) {
                    try {
                      const recovered = JSON.parse(itemsToRender[0].questionText);
                      if (recovered && Array.isArray(recovered.items)) {
                        itemsToRender = recovered.items;
                        if (recovered.title) {
                          const cleanedRec = recovered.title.startsWith('Daily Challenge - Day') || recovered.title === 'Abacus Daily Challenge'
                            ? ''
                            : recovered.title;
                          setCustomSectionTitle(cleanedRec);
                        }
                      }
                    } catch(e) {}
                  }

                  itemsToRender.forEach(item => {
                    if (item.type === 'question') {
                      flatQs.push({
                        id: item.id,
                        dbQuestionId: q.id,
                        virtualType: 'teacher_custom',
                        questionType: item.questionType || 'short_answer',
                        questionText: item.questionText || '',
                        image: item.image || '',
                        options: item.options || [],
                        correctAnswer: item.correctAnswer,
                      })
                    } else if (item.type === 'image_only') {
                      flatQs.push({
                        id: item.id,
                        dbQuestionId: q.id,
                        virtualType: 'image_only',
                        questionText: item.description || '',
                        image: item.image || '',
                        options: [],
                        correctAnswer: null,
                      })
                    }
                    // skip section_header items — they are not answerable
                  })
                  return // successfully parsed, skip raw push
                }
                // Has parsed object but no items array — treat as single question
                if (parsed.title && !parsed.items) {
                  flatQs.push({
                    id: q.id,
                    dbQuestionId: q.id,
                    virtualType: 'teacher_custom',
                    questionType: 'short_answer',
                    questionText: parsed.title || '',
                    image: '',
                    options: [],
                    correctAnswer: q.answer || '',
                  })
                  return
                }
              }
            } catch (e) {
              // JSON parse failed — q.question is a plain string, use as-is
              if (String(q.question).trim().startsWith('{') || String(q.question).trim().startsWith('[')) {
                // Looks like broken JSON — show as a teacher custom question with plain text
                flatQs.push({
                  id: q.id,
                  dbQuestionId: q.id,
                  virtualType: 'teacher_custom',
                  questionType: 'short_answer',
                  questionText: q.question_text || q.display_text || 'Teacher Question',
                  image: '',
                  options: [],
                  correctAnswer: q.answer_text || q.answer || '',
                })
                return
              }
            }
          }
          // Raw DB question (abacus, mul/div, etc.) — push as-is
          flatQs.push(q)
        })


        setQuestions(flatQs)
        setPhase('countdown')
      } catch (err) {
        toast.error(err.response?.data?.message || 'Could not load questions.')
        navigate(isDemo ? '/courses' : `/challenge/day/${dayNum}/sections`, isDemo ? { state: { openDemoDay: true } } : undefined)
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

  let isGoogleForm = false
  let parsedForm = null
  const currentQContent = currentQ?.question || currentQ?.question_text || currentQ?.questionText;
  if (currentQContent) {
    try {
      const parsed = typeof currentQContent === 'string' ? JSON.parse(currentQContent) : currentQContent
      if (parsed && typeof parsed === 'object' && parsed.items) {
        isGoogleForm = true
        parsedForm = parsed
      }
    } catch (e) {}
  }

  const getPages = (items) => {
    const pages = []
    let currentPage = { header: null, items: [] }
    
    items.forEach(item => {
      if (item.type === 'section_header') {
        if (currentPage.items.length > 0 || currentPage.header) {
          pages.push(currentPage)
        }
        currentPage = { header: item, items: [] }
      } else {
        currentPage.items.push(item)
      }
    })
    if (currentPage.items.length > 0 || currentPage.header) {
      pages.push(currentPage)
    }
    return pages.length > 0 ? pages : [{ header: null, items: [] }]
  }

  const handleFormSubmit = () => {
    const questionsList = parsedForm.items.filter(i => i.type === 'question')
    const unanswered = questionsList.filter(item => {
      const ans = formAnswers[item.id]
      if (item.questionType === 'checkbox') {
        return !Array.isArray(ans) || ans.length === 0
      }
      return !ans || !String(ans).trim()
    })

    if (unanswered.length > 0) {
      toast.error('Please answer all questions before submitting.')
      return
    }

    const timeTaken = (Date.now() - questionStartRef.current) / 1000
    const timePerQ = parseFloat((timeTaken / questionsList.length).toFixed(2))

    let formTotalXp = 0
    const formResponses = []

    questionsList.forEach(item => {
      const ans = formAnswers[item.id]
      const isCheckbox = item.questionType === 'checkbox'
      const studentAns = isCheckbox 
        ? JSON.stringify(ans) 
        : String(ans).trim()

      const hasCorrectAnswer = isCheckbox
        ? (Array.isArray(item.correctAnswer) && item.correctAnswer.length > 0)
        : (item.correctAnswer && String(item.correctAnswer).trim() !== '')

      let isCorrect = null
      let xp = 0
      let correctAnsStr = ''

      if (hasCorrectAnswer) {
        if (item.questionType === 'multiple_choice') {
          const correctOpt = item.options.find(o => o.id === item.correctAnswer)
          correctAnsStr = correctOpt ? correctOpt.text : String(item.correctAnswer)
          isCorrect = correctAnsStr.toLowerCase().trim() === studentAns.toLowerCase().trim()
        } else if (item.questionType === 'checkbox') {
          const correctOpts = item.options.filter(o => item.correctAnswer.includes(o.id)).map(o => o.text)
          correctAnsStr = JSON.stringify(correctOpts)
          const studentOpts = ans || []
          isCorrect = correctOpts.length === studentOpts.length && correctOpts.every(o => studentOpts.includes(o))
        } else {
          correctAnsStr = String(item.correctAnswer).trim()
          isCorrect = correctAnsStr.toLowerCase().trim() === studentAns.toLowerCase().trim()
        }
        xp = isCorrect ? 10 : 0
      } else {
        isCorrect = null
        xp = 0
      }

      formTotalXp += xp
      formResponses.push({
        question_id: currentQ.id,
        question_snapshot: item.questionText || 'Custom Question',
        correct_answer: correctAnsStr,
        student_answer: studentAns,
        is_correct: isCorrect,
        time_taken_seconds: timePerQ,
      })
    })

    if (formTotalXp > 0) {
      setLastXp(formTotalXp)
      setTotalXp(prev => prev + formTotalXp)
      setShowXp(true)
      setTimeout(() => setShowXp(false), 900)
    }

    const newResponses = [...responses, ...formResponses]
    setResponses(newResponses)

    setTimerRunning(false)
    submitSection(newResponses)
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

  const [boxFeedbacks, setBoxFeedbacks] = useState([])

  const handleNext = () => {
    if (feedback) return  // prevent double submit during animation

    const isVirtual = currentQ?.virtualType === 'teacher_custom' || currentQ?.virtualType === 'image_only'

    if (isVirtual) {
      if (currentQ.virtualType === 'teacher_custom') {
        if (currentQ.questionType === 'checkbox') {
          let parsed = []
          try { parsed = JSON.parse(answer); } catch (e) {}
          if (!Array.isArray(parsed) || parsed.length === 0) {
            toast.error('Please select at least one option.');
            return;
          }
        } else {
          if (!String(answer).trim()) {
            toast.error('Please enter an answer.');
            return;
          }
        }
      }
    } else {
      const qType = getQuestionType(currentQ);
      const isPowerExercise = section === 'power_exercise' || currentQ?.section === 'power_exercise';
      
      // Parse correct answers
      const correctAns = currentQ.answer_text ?? currentQ.answer ?? currentQ.computedAnswer ?? currentQ.correct_answer
      let correctSteps = []
      try {
        correctSteps = JSON.parse(correctAns);
        if (!Array.isArray(correctSteps)) correctSteps = [correctAns];
      } catch (e) {
        correctSteps = String(correctAns).split('\n').map(s => s.trim()).filter(Boolean);
      }

      if (qType === 'teacher' || isPowerExercise) {
        const blocks = getParsedBlocks(currentQ);
        const hasInputBoxes = blocks.some(b => b.type === 'box' || b.type === 'step' || b.type === 'paragraph');
        const boxesCount = hasInputBoxes
          ? blocks.filter(b => b.type === 'box' || b.type === 'step' || b.type === 'paragraph').length
          : correctSteps.length;

        let parsed = [];
        try { parsed = JSON.parse(answer); if (!Array.isArray(parsed)) parsed = [answer]; } catch (e) { parsed = [answer]; }
        if (parsed.length < boxesCount || parsed.some(v => v === undefined || v === null || !String(v).trim())) {
          toast.error('Please fill in all boxes.');
          return;
        }
      } else {
        if (!String(answer).trim()) {
          toast.error('Please enter an answer.');
          return;
        }
      }
    }

    const timeTaken = (Date.now() - questionStartRef.current) / 1000
    
    let isCorrect = false
    let xp = 0
    let correctAnsStr = ''

    if (isVirtual) {
      if (currentQ.virtualType === 'image_only') {
        isCorrect = true
        xp = 0
        correctAnsStr = ''
        setFeedback('correct')
      } else {
        const isCheckbox = currentQ.questionType === 'checkbox'
        const hasCorrectAnswer = isCheckbox
          ? (Array.isArray(currentQ.correctAnswer) && currentQ.correctAnswer.length > 0)
          : (currentQ.correctAnswer && String(currentQ.correctAnswer).trim() !== '')

        if (hasCorrectAnswer) {
          if (currentQ.questionType === 'multiple_choice') {
            const correctOpt = currentQ.options.find(o => o.id === currentQ.correctAnswer)
            correctAnsStr = correctOpt ? correctOpt.text : String(currentQ.correctAnswer)
            isCorrect = correctAnsStr.toLowerCase().trim() === answer.toLowerCase().trim()
          } else if (currentQ.questionType === 'checkbox') {
            const correctOpts = currentQ.options.filter(o => currentQ.correctAnswer.includes(o.id)).map(o => o.text)
            correctAnsStr = JSON.stringify(correctOpts)
            let studentOpts = []
            try { studentOpts = JSON.parse(answer) || [] } catch (e) {}
            isCorrect = correctOpts.length === studentOpts.length && correctOpts.every(o => studentOpts.includes(o))
          } else {
            correctAnsStr = String(currentQ.correctAnswer).trim()
            isCorrect = correctAnsStr.toLowerCase().trim() === answer.toLowerCase().trim()
          }
          xp = isCorrect ? 10 : 0
          setFeedback(isCorrect ? 'correct' : 'incorrect')
        } else {
          isCorrect = null
          xp = 0
          setFeedback('correct') // visual confirmation for saving response
        }
      }
    } else {
      const qType = getQuestionType(currentQ);
      const isPowerExercise = section === 'power_exercise' || currentQ?.section === 'power_exercise';
      const correctAns = currentQ.answer_text ?? currentQ.answer ?? currentQ.computedAnswer ?? currentQ.correct_answer
      let correctSteps = []
      try {
        correctSteps = JSON.parse(correctAns);
        if (!Array.isArray(correctSteps)) correctSteps = [correctAns];
      } catch (e) {
        correctSteps = String(correctAns).split('\n').map(s => s.trim()).filter(Boolean);
      }

      if (isPowerExercise) {
        let parsedStudent = [];
        try { parsedStudent = JSON.parse(answer); if (!Array.isArray(parsedStudent)) parsedStudent = [answer]; } catch (e) { parsedStudent = [answer]; }
        
        const normalize = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim()
        let correctStepsCount = 0
        
        const feedbacks = correctSteps.map((cStep, idx) => {
          const stepOk = normalize(parsedStudent[idx]) === normalize(cStep)
          if (stepOk) correctStepsCount++
          return stepOk ? 'correct' : 'incorrect'
        })
        
        setBoxFeedbacks(feedbacks)
        isCorrect = (correctStepsCount === correctSteps.length)
        setFeedback(isCorrect ? 'correct' : 'incorrect')
        xp = correctStepsCount * 10
      } else {
        isCorrect = checkAnswer(answer, correctAns, qType)
        setFeedback(isCorrect ? 'correct' : 'incorrect')
        if (isCorrect) playCorrectChime(); else playIncorrectBuzzer();
        xp = isCorrect ? 10 : 0
      }
    }

    if (xp > 0) {
      setLastXp(xp)
      setTotalXp(prev => prev + xp)
      setShowXp(true)
      setTimeout(() => setShowXp(false), 900)
    }

    const resp = {
      question_id: isVirtual ? currentQ.dbQuestionId : currentQ.id,
      question_snapshot: isVirtual ? (currentQ.questionText || 'Custom Question') : buildSnapshot(currentQ),
      correct_answer: isVirtual ? correctAnsStr : (currentQ.answer_text ?? currentQ.answer ?? currentQ.computedAnswer ?? currentQ.correct_answer),
      student_answer: isVirtual ? (currentQ.virtualType === 'image_only' ? '' : answer.trim()) : answer.trim(),
      is_correct: isCorrect,
      time_taken_seconds: parseFloat(timeTaken.toFixed(2)),
    }

    const newResponses = [...responses, resp]
    setResponses(newResponses)

    setTimeout(() => {
      setFeedback(null)
      setBoxFeedbacks([])
      setAnswer('')
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(i => i + 1)
        questionStartRef.current = Date.now()
      } else {
        // Done — submit section
        setTimerRunning(false)
        submitSection(newResponses)
      }
    }, 1500)
  }

  const submitSection = async (finalResponses) => {
    setPhase('submitting')
    const actualSolveTime = finalResponses.reduce((sum, r) => sum + (r.time_taken_seconds || 0), 0)
    try {
      const res = await api.post(`/students/${student.id}/progress/${dayNum}/sections/${section}/submit`, {
        responses: finalResponses,
        timeTakenSeconds: parseFloat(actualSolveTime.toFixed(2)),
      })
      if (res.data && res.data.xpEarned) {
        // Update global context with new XP
        login({ ...student, xp_total: (student.xp_total || 0) + res.data.xpEarned })
      }
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } })
      playFanfare()
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
            {customSectionTitle || SECTION_LABELS[section] || section}
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
    const isDemo = dayNum === 0
    return (
      <div className="page page-bg-dots" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card animate-pop" style={{ maxWidth: 420, width: '100%', margin: '2rem', textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>{isDemo ? '🎮' : '✅'}</div>
          <h2 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            {isDemo ? 'Practice Complete!' : 'Section Complete!'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {customSectionTitle || SECTION_LABELS[section] || section}
            {isDemo && <><br /><span style={{ color: 'var(--warning)', fontSize: '0.85rem' }}>Demo mode — results not saved</span></>}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: isDemo ? '1fr 1fr' : '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div className="report-metric">
              <div className="report-metric__val" style={{ color: 'var(--success)' }}>{correct}</div>
              <div className="report-metric__label">Correct</div>
            </div>
            <div className="report-metric">
              <div className="report-metric__val">{acc}%</div>
              <div className="report-metric__label">Accuracy</div>
            </div>
            {!isDemo && (
              <div className="report-metric">
                <div className="report-metric__val" style={{ color: 'var(--accent-gold)' }}>{totalXp}</div>
                <div className="report-metric__label">XP Earned</div>
              </div>
            )}
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={() => navigate('/courses', { state: isDemo ? { openDemoDay: true } : { openDayNum: dayNum } })}
          >
            {isDemo ? 'Back to Demo →' : 'Back to Paper →'}
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
          <button className="btn btn-primary" onClick={() => navigate('/courses', { state: isDemo ? { openDemoDay: true } : { openDayNum: dayNum } })}>
            {isDemo ? 'Back to Demo' : 'Back to Paper'}
          </button>
        </div>
      </div>
    )
  }

  // ── Attempt phase ──
  if (!currentQ) return null

  const qType = getQuestionType(currentQ)
  const isVirtualCustom = currentQ?.virtualType === 'teacher_custom'
  const isVirtualImageOnly = currentQ?.virtualType === 'image_only'
  const isVirtual = isVirtualCustom || isVirtualImageOnly
  const isAddType = (qType === 'add' || qType === 'visual') && !isVirtual
  const isMulDiv = (qType === 'mul_x' || qType === 'mul_div' || qType === 'two_steps') && !isVirtual
  const isTeacher = qType === 'teacher' && !isVirtual

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
            {customSectionTitle || SECTION_LABELS[section] || section}
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
            <div className="mul-card card-3d animate-pop" style={{ width: '100%' }}>
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

        {/* Virtual Custom Card display */}
        {isVirtualCustom && (
          <div className="mul-card card-3d animate-pop" style={{
            width: '100%',
            maxWidth: 680,
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '1.5rem',
            fontFamily: 'var(--font-sans)',
            fontSize: 'unset',
            fontWeight: 'unset',
            padding: '2rem',
          }}>
            {/* Question Header & Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ 
                fontWeight: 600, 
                fontSize: '1.25rem', 
                color: 'var(--text-primary)', 
                whiteSpace: 'pre-wrap',
                fontFamily: currentQ.questionText && String(currentQ.questionText).match(/^[\d\s\n+\-*/=xX]+$/) ? 'var(--font-mono)' : 'inherit',
                textAlign: currentQ.questionText && String(currentQ.questionText).match(/^[\d\s\n+\-*/=xX]+$/) ? 'right' : 'left',
                display: 'inline-block',
                minWidth: '3rem',
                margin: currentQ.questionText && String(currentQ.questionText).match(/^[\d\s\n+\-*/=xX]+$/) ? '0 auto' : '0'
              }}>
                {currentQ.questionText}
              </div>
              {!(currentQ.questionType === 'checkbox' ? (Array.isArray(currentQ.correctAnswer) && currentQ.correctAnswer.length > 0) : (currentQ.correctAnswer && String(currentQ.correctAnswer).trim() !== '')) && (
                <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>⚠️ To be checked by teacher</span>
              )}
            </div>

            {/* Question Image */}
            {currentQ.image && (
              <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
                <img 
                  src={currentQ.image} 
                  alt="Question" 
                  onClick={() => setZoomedImage(currentQ.image)}
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '550px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border)',
                    cursor: 'zoom-in',
                  }} 
                />
              </div>
            )}

            {/* Answers Inputs */}
            {currentQ.questionType === 'short_answer' && (
              isMultiLineRequired(student?.level, dayNum) ? (
                <textarea
                  rows={2}
                  className={`form-input${feedback ? ` ${feedback}` : ''}`}
                  placeholder="Your answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={!!feedback}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: feedback === 'correct' ? 'var(--success-bg)' : feedback === 'incorrect' ? 'var(--error-bg)' : 'rgba(255,255,255,0.03)',
                    border: feedback === 'correct' ? '1.5px solid var(--success)' : feedback === 'incorrect' ? '1.5px solid var(--error)' : '1.5px solid var(--border)',
                    boxShadow: feedback === 'correct' ? '0 2px 0 #047857' : feedback === 'incorrect' ? '0 2px 0 #b91c1c' : 'unset',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                    fontSize: '1rem',
                    outline: 'none',
                  }}
                />
              ) : (
                <input
                  type="text"
                  className={`form-input${feedback ? ` ${feedback}` : ''}`}
                  placeholder="Your answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNext()}
                  disabled={!!feedback}
                  autoFocus
                  autoComplete="off"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: feedback === 'correct' ? 'var(--success-bg)' : feedback === 'incorrect' ? 'var(--error-bg)' : 'rgba(255,255,255,0.03)',
                    border: feedback === 'correct' ? '1.5px solid var(--success)' : feedback === 'incorrect' ? '1.5px solid var(--error)' : '1.5px solid var(--border)',
                    boxShadow: feedback === 'correct' ? '0 2px 0 #047857' : feedback === 'incorrect' ? '0 2px 0 #b91c1c' : 'unset',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    outline: 'none',
                  }}
                />
              )
            )}

            {currentQ.questionType === 'paragraph' && (
              <textarea
                rows={3}
                className={`form-input${feedback ? ` ${feedback}` : ''}`}
                placeholder="Your answer (paragraph)"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!feedback}
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: feedback === 'correct' ? 'var(--success-bg)' : feedback === 'incorrect' ? 'var(--error-bg)' : 'rgba(255,255,255,0.03)',
                  border: feedback === 'correct' ? '1.5px solid var(--success)' : feedback === 'incorrect' ? '1.5px solid var(--error)' : '1.5px solid var(--border)',
                  boxShadow: feedback === 'correct' ? '0 2px 0 #047857' : feedback === 'incorrect' ? '0 2px 0 #b91c1c' : 'unset',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                  fontSize: '1rem',
                  outline: 'none',
                }}
              />
            )}

            {currentQ.questionType === 'multiple_choice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {currentQ.options.map(opt => (
                  <label key={opt.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: !!feedback ? 'default' : 'pointer',
                    padding: '0.3rem 0',
                    transition: 'all 0.2s ease',
                  }}>
                    <input
                      type="radio"
                      name={currentQ.id}
                      checked={answer === opt.text}
                      disabled={!!feedback}
                      onChange={() => setAnswer(opt.text)}
                      style={{ 
                        accentColor: 'var(--primary)', 
                        transform: 'scale(1.25)', 
                        cursor: !!feedback ? 'default' : 'pointer'
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.05rem', color: 'var(--text-primary)', cursor: !!feedback ? 'default' : 'pointer' }}>{opt.text}</span>
                      {opt.image && (
                        <img src={opt.image} alt={opt.text} style={{ maxHeight: '60px', borderRadius: '4px', border: '1px solid var(--border)' }} />
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {currentQ.questionType === 'checkbox' && (() => {
              let currentVal = []
              try {
                if (answer) {
                  currentVal = JSON.parse(answer)
                  if (!Array.isArray(currentVal)) currentVal = []
                }
              } catch (e) {}

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {currentQ.options.map(opt => {
                    const isChecked = currentVal.includes(opt.text)
                    return (
                      <label key={opt.id} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        cursor: !!feedback ? 'default' : 'pointer',
                        padding: '0.6rem 1rem',
                        background: isChecked ? 'rgba(255,122,0,0.12)' : 'rgba(255,255,255,0.02)',
                        border: isChecked ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                      }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!!feedback}
                          onChange={(e) => {
                            let nextVal = [...currentVal]
                            if (e.target.checked) {
                              nextVal.push(opt.text)
                            } else {
                              nextVal = nextVal.filter(v => v !== opt.text)
                            }
                            setAnswer(JSON.stringify(nextVal))
                          }}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{opt.text}</span>
                          {opt.image && (
                            <img src={opt.image} alt={opt.text} style={{ maxHeight: '60px', borderRadius: '4px', border: '1px solid var(--border)' }} />
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

        {/* Virtual Image Only Card display */}
        {isVirtualImageOnly && (
          <div className="mul-card card-3d animate-pop" style={{
            width: '100%',
            maxWidth: 680,
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '1.5rem',
            fontFamily: 'var(--font-sans)',
            fontSize: 'unset',
            fontWeight: 'unset',
            padding: '2rem',
          }}>
            {/* Question Image */}
            {currentQ.image && (
              <div style={{ textAlign: 'center' }}>
                <img 
                  src={currentQ.image} 
                  alt="Block Image" 
                  onClick={() => setZoomedImage(currentQ.image)}
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '650px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border)',
                    cursor: 'zoom-in',
                  }} 
                />
              </div>
            )}
            
            {currentQ.questionText && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontStyle: 'italic', textAlign: 'center', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {currentQ.questionText}
              </p>
            )}
          </div>
        )}

        {/* Teacher / free-text */}
        {isTeacher && (() => {
          if (isGoogleForm) {
            const pages = getPages(parsedForm.items)
            const currentPage = pages[currentPageIdx] || { header: null, items: [] }

            return (
              <div className="card animate-pop" style={{ maxWidth: 680, width: '100%', padding: '2rem', background: 'var(--bg-card)', boxShadow: 'var(--shadow-lg)' }}>

                {currentPage.header && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '4px solid #673ab7', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{currentPage.header.title}</h3>
                    {currentPage.header.description && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{currentPage.header.description}</p>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {currentPage.items.map((item) => {
                    if (item.type === 'image_only') {
                      return (
                        <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                          {item.image && (
                            <img 
                              src={item.image} 
                              alt={item.description || 'Form block image'} 
                              style={{ maxWidth: '100%', maxHeight: '350px', borderRadius: '6px', border: '1px solid var(--border)' }} 
                            />
                          )}
                          {item.description && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>{item.description}</p>
                          )}
                        </div>
                      )
                    }

                    if (item.type === 'question') {
                      const isCheckbox = item.questionType === 'checkbox'
                      const hasCorrectAnswer = isCheckbox
                        ? (Array.isArray(item.correctAnswer) && item.correctAnswer.length > 0)
                        : (item.correctAnswer && String(item.correctAnswer).trim() !== '')

                      return (
                        <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{item.questionText}</span>
                            {!hasCorrectAnswer && (
                              <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>⚠️ To be checked by teacher</span>
                            )}
                          </div>

                          {item.image && (
                            <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
                              <img src={item.image} alt="Question" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '4px' }} />
                            </div>
                          )}

                          {item.questionType === 'short_answer' && (
                            isMultiLineRequired(student?.level, dayNum) ? (
                              <textarea
                                rows={2}
                                placeholder="Your answer"
                                value={formAnswers[item.id] || ''}
                                onChange={(e) => setFormAnswers({ ...formAnswers, [item.id]: e.target.value })}
                                style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', resize: 'vertical' }}
                              />
                            ) : (
                              <input
                                type="text"
                                placeholder="Your answer"
                                value={formAnswers[item.id] || ''}
                                onChange={(e) => setFormAnswers({ ...formAnswers, [item.id]: e.target.value })}
                                style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)' }}
                              />
                            )
                          )}

                          {item.questionType === 'paragraph' && (
                            <textarea
                              rows={3}
                              placeholder="Your answer (paragraph)"
                              value={formAnswers[item.id] || ''}
                              onChange={(e) => setFormAnswers({ ...formAnswers, [item.id]: e.target.value })}
                              style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', resize: 'vertical' }}
                            />
                          )}

                          {item.questionType === 'multiple_choice' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                              {item.options.map(opt => (
                                <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.3rem 0' }}>
                                  <input
                                    type="radio"
                                    name={item.id}
                                    checked={formAnswers[item.id] === opt.text}
                                    onChange={() => setFormAnswers({ ...formAnswers, [item.id]: opt.text })}
                                    style={{ transform: 'scale(1.25)', cursor: 'pointer' }}
                                  />
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{opt.text}</span>
                                    {opt.image && (
                                      <img src={opt.image} alt={opt.text} style={{ maxHeight: '60px', borderRadius: '4px', border: '1px solid var(--border)' }} />
                                    )}
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}

                          {item.questionType === 'checkbox' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {item.options.map(opt => {
                                const currentVal = Array.isArray(formAnswers[item.id]) ? formAnswers[item.id] : []
                                const isChecked = currentVal.includes(opt.text)
                                return (
                                  <label key={opt.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.3rem 0' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        let nextVal = [...currentVal]
                                        if (e.target.checked) {
                                          nextVal.push(opt.text)
                                        } else {
                                          nextVal = nextVal.filter(v => v !== opt.text)
                                        }
                                        setFormAnswers({ ...formAnswers, [item.id]: nextVal })
                                      }}
                                    />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span>{opt.text}</span>
                                      {opt.image && (
                                        <img src={opt.image} alt={opt.text} style={{ maxHeight: '60px', borderRadius: '4px', border: '1px solid var(--border)' }} />
                                      )}
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    }

                    return null
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={currentPageIdx === 0}
                    onClick={() => setCurrentPageIdx(p => p - 1)}
                  >
                    ◀ Back
                  </button>

                  {currentPageIdx < pages.length - 1 ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setCurrentPageIdx(p => p + 1)}
                    >
                      Next Page ▶
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-teacher"
                      onClick={handleFormSubmit}
                    >
                      Submit Form 🚀
                    </button>
                  )}
                </div>
              </div>
            )
          }

          const blocks = [...getParsedBlocks(currentQ)];
          const isPowerExercise = section === 'power_exercise' || currentQ?.section === 'power_exercise';
          
          const correctAns = currentQ.answer_text ?? currentQ.answer ?? currentQ.computedAnswer ?? currentQ.correct_answer;
          let correctSteps = [];
          try {
            correctSteps = JSON.parse(correctAns);
            if (!Array.isArray(correctSteps)) correctSteps = [correctAns];
          } catch (e) {
            correctSteps = String(correctAns).split('\n').map(s => s.trim()).filter(Boolean);
          }

          const hasInputBoxes = blocks.some(b => b.type === 'box' || b.type === 'step' || b.type === 'paragraph');
          if (isPowerExercise && !hasInputBoxes) {
            correctSteps.forEach(() => {
              blocks.push({ type: 'step', answer: '' });
            });
          }

          let parsedAns = [];
          try { parsedAns = JSON.parse(answer); if(!Array.isArray(parsedAns)) parsedAns = [answer]; } catch (e) { parsedAns = [answer]; }
          let boxIndex = 0;

          return (
            <div className="card animate-pop" style={{ maxWidth: 600, width: '100%', padding: '2rem' }}>
              {currentQ.format_example && (
                <div style={{ 
                  background: 'rgba(163, 123, 168, 0.1)', border: '1px solid rgba(163, 123, 168, 0.3)',
                  color: '#c084fc', padding: '0.5rem 1rem', borderRadius: '8px', 
                  fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center',
                  whiteSpace: 'pre-wrap'
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
                      const boxFeedbackClass = boxFeedbacks[currentBoxIdx] 
                        ? `feedback-${boxFeedbacks[currentBoxIdx]}` 
                        : (feedback ? `feedback-${feedback}` : '');
                      
                      if (block.type === 'paragraph') {
                        return (
                          <textarea
                            key={idx}
                            className={boxFeedbackClass}
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

                      const inputElem = isMultiLineRequired(student?.level, dayNum) ? (
                        <textarea
                          key={idx}
                          className={boxFeedbackClass}
                          style={{
                            width: '100%', minHeight: '60px', display: 'block', margin: '0.5rem 0',
                            padding: '0.4rem', fontSize: '1.1rem', borderRadius: '4px', border: '1px solid var(--border)',
                            background: 'transparent', color: 'var(--text-primary)', resize: 'vertical'
                          }}
                          value={parsedAns[currentBoxIdx] || ''}
                          onChange={e => {
                            const newAns = [...parsedAns];
                            newAns[currentBoxIdx] = e.target.value;
                            setAnswer(JSON.stringify(newAns));
                          }}
                          disabled={!!feedback}
                          autoFocus={currentBoxIdx === 0}
                        />
                      ) : (
                        <input
                          key={idx}
                          type="text"
                          className={boxFeedbackClass}
                          style={{
                            width: '120px', textAlign: 'center', display: 'inline-block', margin: '0 0.5rem',
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
                    } else if (block.type === 'image') {
                      return (
                        <img
                          key={idx}
                          src={block.content}
                          style={{ maxWidth: '100%', maxHeight: '300px', display: 'block', margin: '1rem auto', borderRadius: '8px', boxShadow: 'var(--shadow-md)' }}
                          alt="Question Visual"
                        />
                      );
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
                        <span key={idx} style={{ display: 'inline-block', marginBottom: '1rem', width: '100%', whiteSpace: 'pre-wrap' }}>
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
            disabled={
              !!feedback || 
              (isVirtualCustom && currentQ.questionType === 'checkbox' 
                ? (() => {
                    let parsed = [];
                    try { parsed = JSON.parse(answer); } catch(e) {}
                    return !Array.isArray(parsed) || parsed.length === 0;
                  })()
                : (isVirtualImageOnly ? false : !answer.trim()))
            }
          >
            {currentIndex === questions.length - 1 ? '✓ Finish Section' : 'Next →'}
          </button>
        </div>
      </div>

      {/* Lightbox for zooming images */}
      {zoomedImage && (
        <div 
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
            padding: '2rem',
          }}
        >
          <img 
            src={zoomedImage} 
            alt="Zoomed Visual" 
            style={{ 
              maxWidth: '95%', 
              maxHeight: '95%', 
              objectFit: 'contain', 
              borderRadius: '8px', 
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              border: '2px solid rgba(255,255,255,0.1)',
            }} 
          />
        </div>
      )}
    </div>
  )
}
