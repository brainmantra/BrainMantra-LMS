const fs = require('fs');
let code = fs.readFileSync('backend/routes/students.js', 'utf-8');

// We don't need fetchAndParseForm and getFormUrl anymore
code = code.replace(
  /import \{ getFormUrl \} from '\.\.\/utils\/formsConfig\.js'/,
  "// Removed formsConfig import"
);
code = code.replace(
  /import \{ fetchAndParseForm \} from '\.\.\/utils\/formParser\.js'/,
  "// Removed formParser import"
);

// Rewrite /questions route
const questionsOld = /router\.get\('\/:id\/progress\/:dayNumber\/questions', async \(req, res\) => \{[\s\S]*?\}\)/;
const questionsNew = `router.get('/:id/progress/:dayNumber/questions', async (req, res) => {
  try {
    const student = await getStudentById(parseInt(req.params.id, 10))
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const dayNumber = parseInt(req.params.dayNumber, 10)
    
    // Fetch questions from DB instead of Google Forms
    const { rows: questions } = await pool.query(
      \`SELECT id, question_text AS title, question_type AS type, expected_answer AS "computedAnswer", format_example AS "formatExample"
       FROM questions 
       WHERE level = $1 AND day_number = $2
       ORDER BY id ASC\`,
      [student.level, dayNumber]
    )

    if (questions.length === 0) {
      return res.status(404).json({ message: 'Questions not configured for this day.' })
    }

    res.json({ questions, submitUrl: '' })
  } catch (err) {
    console.error('[questions] Error:', err)
    res.status(500).json({ message: 'Server error fetching questions.' })
  }
})`;
code = code.replace(questionsOld, questionsNew);

// Rewrite /submit route
// Find from router.post('/:id/progress/:dayNumber/submit'... to res.json({ success: true, ... })
const submitRegex = /router\.post\('\/:id\/progress\/:dayNumber\/submit', async \(req, res\) => \{[\s\S]*?res\.json\(\{ success: true, newStreak, streakUpdated \}\)\n  \} catch \(err\) \{/;

const submitNew = `router.post('/:id/progress/:dayNumber/submit', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10)
    const dayNumber = parseInt(req.params.dayNumber, 10)
    const { answers, questionTimes, totalTimeSeconds, xpEarned, accuracy } = req.body

    const student = await getStudentById(studentId)
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    // Save the metrics directly to day_records (no google forms submission)
    await pool.query(
      \`INSERT INTO day_records (student_id, day_number, time_taken_seconds, question_times, answers, xp_earned, accuracy, completed, completed_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())
       ON CONFLICT (student_id, day_number)
       DO UPDATE SET 
          time_taken_seconds = EXCLUDED.time_taken_seconds,
          question_times = EXCLUDED.question_times,
          answers = EXCLUDED.answers,
          xp_earned = EXCLUDED.xp_earned,
          accuracy = EXCLUDED.accuracy,
          completed = TRUE,
          completed_at = NOW(),
          updated_at = NOW()\`,
      [studentId, dayNumber, totalTimeSeconds, JSON.stringify(questionTimes), JSON.stringify(answers), xpEarned || 0, accuracy || 0]
    )
    
    // Update global xp if we had a students.total_xp column, but we just track via day_records sum
    
    // --- Streak Logic (Unchanged) ---
    const { rows: records } = await pool.query(
      'SELECT day_number FROM day_records WHERE student_id = $1 AND completed = true ORDER BY day_number ASC',
      [studentId]
    )

    let newStreak = 0
    let streakUpdated = false
    if (records.length > 0) {
      const dayNums = records.map(r => r.day_number)
      let currentStreak = 1
      for (let i = dayNums.length - 1; i > 0; i--) {
        if (dayNums[i] - dayNums[i-1] === 1) {
          currentStreak++
        } else {
          break
        }
      }
      newStreak = currentStreak
      const longest = Math.max(student.longest_streak, newStreak)

      if (newStreak !== student.streak || longest !== student.longest_streak) {
        await pool.query(
          'UPDATE students SET streak = $1, longest_streak = $2, last_streak_check = NOW() WHERE id = $3',
          [newStreak, longest, studentId]
        )
        streakUpdated = true
      }
    }
    
    res.json({ success: true, newStreak, streakUpdated })
  } catch (err) {`;

code = code.replace(submitRegex, submitNew);

fs.writeFileSync('backend/routes/students.js', code);
