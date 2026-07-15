const fs = require('fs');
let code = fs.readFileSync('src/pages/DayModal.jsx', 'utf-8');

// Add answerFeedback state
code = code.replace(
  "const [msElapsed, setMsElapsed] = useState(0)",
  "const [msElapsed, setMsElapsed] = useState(0)\n  const [answerFeedback, setAnswerFeedback] = useState(null)"
);

// Replace handleNext
code = code.replace(
  /const handleNext = async \(\) => \{[\s\S]*?const submitTest = async/m,
`const handleNext = async () => {
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
    if (currentQ.computedAnswer !== null) {
      isCorrect = parseFloat(currentAnswer.trim()) === parseFloat(currentQ.computedAnswer)
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
      isMath: currentQ.computedAnswer !== null,
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

  const submitTest = async`
);

// Replace submitTest
code = code.replace(
  /const submitTest = async \(finalAnswers, finalTimes\) => \{[\s\S]*?const handleClose = \(\) => navigate\('\/challenge'\)/m,
`const submitTest = async (finalAnswers, finalTimes, finalXp) => {
    setPhase('submitting')
    setLoadingMsg('Evaluating your speed & syncing...')
    const totalTimeSeconds = finalTimes.reduce((acc, curr) => acc + curr.timeTaken, 0)
    setTotalTime(totalTimeSeconds)

    const mathAnswers = finalAnswers.filter(a => a.isMath)
    const correctAnswers = mathAnswers.filter(a => a.isCorrect)
    const accuracy = mathAnswers.length > 0 ? Math.round((correctAnswers.length / mathAnswers.length) * 100) : 0

    try {
      await api.post(\`/students/\${student.id}/progress/\${dayNum}/submit\`, {
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

  const handleClose = () => navigate('/challenge')`
);

// Add feedback class to input
code = code.replace(
  /className="test-input"/g,
  "className={`test-input ${answerFeedback ? 'feedback-' + answerFeedback : ''}`}"
);

// Disable input when answerFeedback is truthy
code = code.replace(
  /autoFocus\n\s*placeholder="Your answer..."/g,
  "autoFocus\n              disabled={!!answerFeedback}\n              placeholder=\"Your answer...\""
);

// Disable Next button during feedback
code = code.replace(
  /<button className="btn btn-primary btn-block" onClick=\{handleNext\}>/g,
  "<button className=\"btn btn-primary btn-block\" onClick={handleNext} disabled={!!answerFeedback}>"
);


// We will replace the entire summary phase UI block.
// First, extract the old summary phase
const oldSummary = /if \(phase === 'summary'\) \{[\s\S]*?if \(phase === 'error'\)/;

const newSummary = `if (phase === 'summary') {
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
              <h1 className="quiz-header-title">Day {dayNum} Mastery</h1>
              <p className="quiz-header-subtitle">🎉 Your Progress Matters, {student.name.split(' ')[0]}!</p>
              
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
              <img src="/avatar-placeholder.png" alt="Avatar" className="quiz-avatar-img" onError={(e) => { e.target.onerror = null; e.target.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + student.name }} />
              <button className="btn-quiz btn-quiz-white">Shop</button>
            </div>
          </div>

          {/* Accuracy & Performance */}
          <div className="quiz-metrics-grid">
            
            <div className="quiz-accuracy-card">
              <h3 className="quiz-card-title">Accuracy ℹ</h3>
              <div className="quiz-accuracy-timeline">
                {/* Simulated timeline based on screenshot */}
                <div className="quiz-accuracy-scale">
                  <span>100%</span><span>80%</span><span>60%</span><span>40%</span><span>20%</span><span>0%</span>
                </div>
                <div className="quiz-accuracy-plot">
                  <div className="quiz-accuracy-point" style={{ bottom: \`\${accuracy}%\` }}>
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
                <p className="quiz-review-subtitle">See your answers vs correct answers</p>
              </div>
              <button className="btn-quiz btn-quiz-white">Study Flashcards</button>
            </div>
            
            <div className="quiz-review-list">
              {mathAnswers.map((ans, i) => (
                <div key={i} className={\`quiz-review-item \${ans.isCorrect ? 'item-correct' : 'item-incorrect'}\`}>
                  <div className="review-item-number">{i + 1}.</div>
                  <div className="review-item-content">
                    <div className="review-item-title">{ans.title.split('\\n').map((l, j) => <div key={j}>{l}</div>)}</div>
                    <div className="review-item-answers">
                      <div className={\`review-answer user-answer \${ans.isCorrect ? 'text-correct' : 'text-incorrect'}\`}>
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

  if (phase === 'error') {`;

code = code.replace(oldSummary, newSummary);

fs.writeFileSync('src/pages/DayModal.jsx', code);
