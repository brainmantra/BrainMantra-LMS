/**
 * utils/questionSelector.js
 * Determines which questions from question_bank to show for a given day/section.
 * Uses modular rotation so questions cycle across 100 days without exhaustion.
 */
import pool from '../db.js'

// ── Section definitions per level ─────────────────────────────────────────────
export const LEVEL_SECTIONS = {
  l1: ['abacus', 'teacher_input'],
  l2: ['abacus', 'visual', 'tables'],
  l3: ['abacus', 'visual', 'multiplication', 'two_steps'],
  l4: ['abacus', 'visual', 'multiplication', 'division', 'form_the_question'],
  l5: ['abacus', 'visual', 'multiplication', 'division', 'cracking'],
  l6: ['abacus', 'visual', 'multiplication', 'division', 'bodmas'],
  l7: ['abacus', 'visual', 'multiplication', 'division', 'two_steps'],
  l8: ['abacus', 'visual', 'multiplication', 'division', 'cracking'],
}

// Teacher-input sections that come from teacher_questions table, not question_bank
export const TEACHER_INPUT_SECTIONS = new Set([
  'teacher_input', 'form_the_question', 'cracking', 'bodmas'
])

// ── Every-5th-day check ────────────────────────────────────────────────────────
export function isTeacherDay(dayNumber) {
  return dayNumber % 5 === 0
}

// ── Questions per section per day ──────────────────────────────────────────────
const QUESTIONS_PER_SECTION = 5

// ── Select questions for a level/section/day from question_bank ────────────────
export async function selectQuestionsForDay(level, section, dayNumber, count = QUESTIONS_PER_SECTION) {
  // Fetch all questions for this level+section ordered by index
  const { rows: allQs } = await pool.query(
    `SELECT * FROM question_bank
     WHERE level = $1 AND section = $2
     ORDER BY question_index ASC`,
    [level, section]
  )

  if (allQs.length === 0) return []

  // Modular rotation: day N slot i → index ((N-1)*count + i) % total
  const selected = []
  for (let i = 0; i < count; i++) {
    const idx = ((dayNumber - 1) * count + i) % allQs.length
    selected.push(allQs[idx])
  }

  return selected
}

// ── Fetch teacher-submitted question for a section/day ─────────────────────────
export async function getTeacherQuestion(level, dayNumber, section = 'teacher_day') {
  const { rows } = await pool.query(
    `SELECT * FROM teacher_questions
     WHERE level = $1 AND day_number = $2 AND section = $3`,
    [level, dayNumber, section]
  )
  return rows[0] || null
}

// ── Get section list for a level on a specific day ─────────────────────────────
export function getSectionsForLevel(level, dayNumber) {
  return LEVEL_SECTIONS[level] || ['abacus']
}

export async function getSectionsForLevelAsync(level, dayNumber) {
  const defaultSections = LEVEL_SECTIONS[level] || ['abacus']
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT section FROM teacher_questions 
       WHERE level = $1 AND day_number = $2 AND section != 'teacher_day'`,
      [level, dayNumber]
    )
    const teacherSections = rows.map(r => r.section)
    const combined = [...defaultSections]
    for (const sec of teacherSections) {
      if (!combined.includes(sec)) {
        combined.push(sec)
      }
    }
    return combined
  } catch (err) {
    console.error('[getSectionsForLevelAsync]', err)
    return defaultSections
  }
}

// ── Section display labels ─────────────────────────────────────────────────────
export const SECTION_LABELS = {
  abacus:            '🧮 Abacus',
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
}
