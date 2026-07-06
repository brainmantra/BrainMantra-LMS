/**
 * utils/answerChecker.js
 * Normalises and compares student answers to correct answers.
 */

/**
 * @param {string} studentInput
 * @param {number|string} correctAnswer
 * @param {string} questionType  'add'|'visual'|'mul_x'|'mul_div'|'teacher'
 */
export function checkAnswer(studentInput, correctAnswer, questionType) {
  if (studentInput === undefined || studentInput === null) return false
  
  // Teacher-type: case-insensitive string comparison (normalise whitespace)
  if (questionType === 'teacher') {
    const normalize = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim()
    
    // Check if JSON arrays (multi-box)
    try {
      const parsedStudent = JSON.parse(studentInput)
      const parsedCorrect = JSON.parse(correctAnswer)
      
      if (Array.isArray(parsedStudent) && Array.isArray(parsedCorrect)) {
        if (parsedStudent.length !== parsedCorrect.length) return false
        return parsedStudent.every((ans, i) => normalize(ans) === normalize(parsedCorrect[i]))
      }
    } catch (e) {
      // Not JSON, fallback to standard comparison
    }
    
    return normalize(studentInput) === normalize(correctAnswer)
  }

  // Handle two_steps comparison (normalise spaces)
  if (questionType === 'two_steps') {
    const cleanStr = s => String(s).toLowerCase().replace(/\s+/g, '')
    return cleanStr(studentInput) === cleanStr(correctAnswer)
  }

  // Handle remainder answers string check (e.g. "91..1" or "91 r 1")
  if (String(correctAnswer).includes('..')) {
    const cleanStr = s => String(s).toLowerCase().replace(/\s+/g, '').replace('r', '..').replace('rem', '..')
    return cleanStr(studentInput) === cleanStr(correctAnswer)
  }

  // Numeric: strip whitespace, normalise decimal separator
  const cleaned = String(studentInput).replace(/\s/g, '').replace(',', '.')
  const studentNum = parseFloat(cleaned)
  const correctNum = parseFloat(correctAnswer)

  if (isNaN(studentNum) || isNaN(correctNum)) return false

  // ADD and VISUAL: allow 0.01 tolerance (decimal rounding)
  if (questionType === 'add' || questionType === 'visual') {
    return Math.abs(studentNum - correctNum) <= 0.01
  }

  // MUL/DIV: exact to 3 decimal places
  return Math.abs(studentNum - correctNum) < 0.001
}

/**
 * Format a numeric answer for display (strip unnecessary trailing zeros)
 */
export function formatAnswer(answer) {
  const num = parseFloat(answer)
  if (isNaN(num)) return String(answer)
  // If effectively an integer
  if (Number.isInteger(num)) return String(num)
  return num.toFixed(2).replace(/\.?0+$/, '')
}
