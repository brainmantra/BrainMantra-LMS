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

// ── Select questions for a level/section/day from question_bank ────────────────
export async function selectQuestionsForDay(level, section, dayNumber, count = QUESTIONS_PER_SECTION) {
  // If GM, use the exact same questions as Alumni
  const targetLevel = level === 'gm' ? 'alumni' : level;
  
  // Fetch all questions for this level+section ordered by index
  const { rows: allQs } = await pool.query(
    `SELECT * FROM question_bank
     WHERE level = $1 AND section = $2
     ORDER BY question_index ASC`,
    [targetLevel, section]
  )

  if (allQs.length === 0) return []

  // Modular rotation: day N slot i → index ((N-1)*count + i) % total
  const selected = []
  for (let i = 0; i < count; i++) {
    const idx = (dayNumber * count + i) % allQs.length
    selected.push(allQs[idx])
  }

  return selected
}

// ── Fetch teacher-submitted question for a section/day ─────────────────────────
export async function getTeacherQuestion(level, dayNumber, section = 'teacher_day') {
  // If GM, use the exact same questions as Alumni
  const targetLevel = level === 'gm' ? 'alumni' : level;
  
  const { rows } = await pool.query(
    `SELECT * FROM teacher_questions
     WHERE level = $1 AND day_number = $2 
     AND LOWER(REPLACE(section, ' ', '_')) = $3`,
    [targetLevel, dayNumber, section.toLowerCase()]
  )
  return rows[0] || null
}

// ── Get section list for a level on a specific day ─────────────────────────────
export function getSectionsForLevel(level, dayNumber) {
  if (level !== 'l1' && level !== 'beginner' && dayNumber > 0 && dayNumber % 5 === 0) {
    return ['power_exercise']
  }
  return LEVEL_SECTIONS[level] || ['abacus']
}

export async function getSectionsForLevelAsync(level, dayNumber) {
  let defaultSections = []
  if (level !== 'l1' && level !== 'beginner' && dayNumber > 0 && dayNumber % 5 === 0) {
    defaultSections = ['power_exercise']
  } else {
    defaultSections = [...(LEVEL_SECTIONS[level] || ['abacus'])]
    if (level !== 'l1' && level !== 'beginner' && dayNumber === 0) {
      defaultSections.push('power_exercise')
    }
  }

  const targetLevel = level === 'gm' ? 'alumni' : level;

  try {
    const { rows: tRows } = await pool.query(
      `SELECT DISTINCT section FROM teacher_questions 
       WHERE level = $1 AND day_number = $2 AND section != 'teacher_day'`,
      [targetLevel, dayNumber]
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
      [targetLevel]
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
