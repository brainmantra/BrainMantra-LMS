/**
 * utils/questionSelector.js
 * Determines which questions from question_bank to show for a given day/section.
 * Uses modular rotation so questions cycle across 100 days without exhaustion.
 */
import pool from '../db.js'

// ── Section definitions per level ─────────────────────────────────────────────
export const LEVEL_SECTIONS = {
  beginner: ['abacus', 'bead_fun', 'activity'],
  l1: ['abacus', 'bead_fun', 'activity'],
  l2: ['abacus', 'visual', 'tables'],
  l3: ['abacus', 'visual', 'multiplication', 'two_steps'],
  l4: ['abacus', 'visual', 'multiplication', 'division'],
  l5: ['abacus', 'visual', 'multiplication', 'division'],
  l6: ['abacus', 'visual', 'multiplication', 'division'],
  l7: ['abacus', 'visual', 'multiplication', 'division', 'two_steps'],
  l8: ['abacus', 'visual', 'multiplication', 'division'],
  alumni: ['abacus'],
  gm: ['abacus'],
}

// Teacher-input sections that come from teacher_questions table, not question_bank
export const TEACHER_INPUT_SECTIONS = new Set([
  'form_the_question', 'cracking', 'bodmas', 'power_exercise', 'bead_fun', 'activity'
])

// ── Every-5th-day check ────────────────────────────────────────────────────────
export function isTeacherDay(dayNumber) {
  if (dayNumber === 0) return false
  return dayNumber % 5 === 0
}

// ── Questions per section per day ──────────────────────────────────────────────
const QUESTIONS_PER_SECTION = 5

// ── Deterministic fallback generator in case question_bank is ever unavailable ───
function generateFallbackQuestions(level, section, dayNumber, count = QUESTIONS_PER_SECTION) {
  const list = []
  for (let i = 0; i < count; i++) {
    const seed = (Math.max(1, dayNumber) * 37 + i * 19 + 7)
    let q = {
      id: 80000 + Math.max(1, dayNumber) * 10 + i,
      level,
      section,
      question_index: i + 1,
      is_teacher_input: false,
    }

    if (section === 'multiplication') {
      const op1 = 12 + (seed % 87)
      const op2 = 2 + ((seed * 3) % 8)
      q.question_type = 'mul_x'
      q.operand1 = op1
      q.operator = '×'
      q.operand2 = op2
      q.answer = op1 * op2
    } else if (section === 'division') {
      const divisor = 2 + (seed % 8)
      const quotient = 10 + ((seed * 7) % 89)
      const dividend = divisor * quotient
      q.question_type = 'mul_div'
      q.operand1 = dividend
      q.operator = '÷'
      q.operand2 = divisor
      q.answer = quotient
    } else if (section === 'tables') {
      const op1 = 2 + (seed % 8)
      const op2 = 2 + ((seed * 5) % 8)
      q.question_type = 'mul_x'
      q.operand1 = op1
      q.operator = '×'
      q.operand2 = op2
      q.answer = op1 * op2
    } else if (section === 'two_steps') {
      const s1 = 12 + (seed % 87)
      const s2 = 2 + ((seed * 3) % 8)
      const t = Math.floor(s1 / 10)
      const u = s1 % 10
      const part1 = String(t * 10 * s2).padStart(3, '0')
      const part2 = String(u * s2).padStart(2, '0')
      q.question_type = 'two_steps'
      q.operand1 = s1
      q.operator = '×'
      q.operand2 = s2
      q.answer_text = `${part1} + ${part2}`
      q.answer = s1 * s2
    } else {
      // Abacus / Visual addition & subtraction
      const rowCount = (level === 'beginner') ? 3 : (level === 'l1') ? 4 : 5
      const digitMax = (level === 'beginner' || level === 'l1') ? 9 : (level === 'l2' || level === 'l3') ? 99 : 999
      const digitMin = (level === 'beginner' || level === 'l1') ? 1 : (level === 'l2' || level === 'l3') ? 10 : 100
      let addends = []
      let sum = 0
      for (let r = 0; r < rowCount; r++) {
        let val = digitMin + ((seed * (r + 1) * 13) % (digitMax - digitMin + 1))
        if (r > 0 && ((seed + r) % 2 === 0)) val = -val
        if (sum + val < 0) val = Math.abs(val)
        sum += val
        addends.push(val)
      }
      q.question_type = 'add'
      q.addends = addends
      q.answer = sum
    }
    list.push(q)
  }
  return list
}

// ── Select questions for a level/section/day from question_bank ────────────────
export async function selectQuestionsForDay(level, section, dayNumber, count = QUESTIONS_PER_SECTION) {
  try {
    // Fetch all questions for this level+section ordered by index
    const { rows: allQs } = await pool.query(
      `SELECT * FROM question_bank
       WHERE level = $1 AND section = $2
       ORDER BY question_index ASC`,
      [level, section]
    )

    if (allQs.length === 0) {
      return generateFallbackQuestions(level, section, dayNumber, count)
    }

    // Modular unique rotation: day N slot i → index ((N-1)*count + i) % total
    // 500 questions in bank / 5 questions per day = 100 completely distinct days!
    const selected = []
    const dayOffset = Math.max(0, dayNumber - 1)
    for (let i = 0; i < count; i++) {
      const idx = (dayOffset * count + i) % allQs.length
      selected.push(allQs[idx])
    }

    return selected
  } catch (err) {
    console.error('[selectQuestionsForDay error, falling back to dynamic generator]:', err)
    return generateFallbackQuestions(level, section, dayNumber, count)
  }
}

// ── Fetch teacher-submitted question for a section/day ─────────────────────────
export async function getTeacherQuestion(level, dayNumber, section = 'teacher_day') {
  const secKey = section.toLowerCase().replace(/ /g, '_');
  
  const { rows } = await pool.query(
    `SELECT * FROM teacher_questions
     WHERE level = $1 AND day_number = $2 
     AND LOWER(REPLACE(section, ' ', '_')) = $3`,
    [level, dayNumber, secKey]
  )
  return rows[0] || null
}

// ── Get section list for a level on a specific day ─────────────────────────────
export function getSectionsForLevel(level, dayNumber) {
  let defaultSections = [...(LEVEL_SECTIONS[level] || ['abacus'])]
  if (level !== 'l1' && level !== 'beginner' && dayNumber > 0 && dayNumber % 5 === 0) {
    if (!defaultSections.includes('power_exercise')) {
      defaultSections.push('power_exercise')
    }
  }
  return defaultSections
}

export async function getSectionsForLevelAsync(level, dayNumber) {
  let defaultSections = [...(LEVEL_SECTIONS[level] || ['abacus'])]
  if (level !== 'l1' && level !== 'beginner' && dayNumber > 0 && dayNumber % 5 === 0) {
    if (!defaultSections.includes('power_exercise')) {
      defaultSections.push('power_exercise')
    }
  }
  if (level !== 'l1' && level !== 'beginner' && dayNumber === 0) {
    if (!defaultSections.includes('power_exercise')) {
      defaultSections.push('power_exercise')
    }
  }

  try {
    const { rows: tRows } = await pool.query(
      `SELECT DISTINCT section FROM teacher_questions 
       WHERE level = $1 AND day_number = $2 AND section != 'teacher_day'`,
      [level, dayNumber]
    )
    const teacherSections = tRows.map(r => r.section.toLowerCase().replace(/ /g, '_'))
    const combined = [...defaultSections]
    for (const sec of teacherSections) {
      if (!combined.includes(sec)) {
        combined.push(sec)
      }
    }

    const { rows: qbRows } = await pool.query(
      `SELECT DISTINCT section FROM question_bank WHERE level = $1`,
      [level]
    )
    const validBankSections = new Set(qbRows.map(r => r.section))

    return combined.filter(sec => 
      TEACHER_INPUT_SECTIONS.has(sec) || 
      validBankSections.has(sec) || 
      sec === 'power_exercise' ||
      teacherSections.includes(sec)
    )
  } catch (err) {
    console.error('[getSectionsForLevelAsync]', err)
    return defaultSections
  }
}

// ── Section display labels ─────────────────────────────────────────────────────
export const SECTION_LABELS = {
  abacus:            '🧮 Abacus',
  bead_fun:          '🧮 Bead Fun',
  activity:          '⚡ Activity',
  visual:            '👁 Visual',
  multiplication:    '✖ Multiplication',
  division:          '➗ Division',
  tables:            '📋 Tables',
  form_the_question: '✏ Form The Question',
  teacher_input:     '👨‍🏫 Teacher Section',
  teacher_day:       '🌟 Special Day Question',
  two_steps:         '📋 2 Steps',
  cracking:          '✏ Cracking',
  bodmas:            '🧮 Bodmas',
  power_exercise:    '⚡ Power Exercise',
}
