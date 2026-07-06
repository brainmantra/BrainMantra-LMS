import 'dotenv/config'
import pool from './db.js'

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Generates an array of addends (positive or negative) with no negative intermediate running sums
function generateAddends(rowCount, digitCount, isDecimal = false) {
  let addends = []
  let sum = 0
  
  for (let r = 0; r < rowCount; r++) {
    let val = 0
    // Try to find a valid addend
    for (let attempt = 0; attempt < 100; attempt++) {
      if (isDecimal) {
        // Decimal numbers like X.XX
        const num = parseFloat((Math.random() * (Math.pow(10, digitCount) - 1) + 1).toFixed(2))
        val = Math.random() > 0.4 && r > 0 ? -num : num
      } else {
        const num = randomInt(Math.pow(10, digitCount - 1), Math.pow(10, digitCount) - 1)
        val = Math.random() > 0.4 && r > 0 ? -num : num
      }
      
      // First row must be positive
      if (r === 0) val = Math.abs(val)
      
      const nextSum = parseFloat((sum + val).toFixed(2))
      if (nextSum >= 0) {
        val = parseFloat(val.toFixed(2))
        sum = nextSum
        addends.push(val)
        break
      }
    }
  }
  
  // Fallback if loop failed to find valid sequence
  if (addends.length < rowCount) {
    return generateAddends(rowCount, digitCount, isDecimal)
  }
  
  return { addends, answer: sum }
}

async function seed() {
  console.log('[seedQuestions] Connecting to DB...')
  const client = await pool.connect()
  
  try {
    console.log('[seedQuestions] Clearing existing auto-generated questions from question_bank (Levels 2-8)...')
    await client.query(`DELETE FROM question_bank WHERE level IN ('l2','l3','l4','l5','l6','l7','l8')`)
    
    let totalUpserted = 0
    
    // Helper to insert question into question_bank
    async function insertQuestion(level, section, index, type, data) {
      await client.query(
        `INSERT INTO question_bank 
          (level, section, question_index, question_type, addends, operand1, operator, operand2, answer, answer_text, is_teacher_input)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE)`,
        [
          level,
          section,
          index,
          type,
          data.addends ? JSON.stringify(data.addends) : null,
          data.operand1 ?? null,
          data.operator ?? null,
          data.operand2 ?? null,
          data.answer ?? null,
          data.answer_text ?? null
        ]
      )
      totalUpserted++
    }

    console.log('[seedQuestions] Generating questions for Level 2...')
    for (let i = 1; i <= 500; i++) {
      // Abacus: 2-digit, 4 to 5 row vertical (both add/sub, running sum >= 0)
      const abacusRows = randomInt(4, 5)
      const abacusData = generateAddends(abacusRows, 2, false)
      await insertQuestion('l2', 'abacus', i, 'add', abacusData)
      
      // Visual: 1-digit, 6 or 7 row vertical (both add/sub, running sum >= 0)
      const visualRows = randomInt(6, 7)
      const visualData = generateAddends(visualRows, 1, false)
      await insertQuestion('l2', 'visual', i, 'add', visualData)
      
      // Tables: 1-digit multiplied with 1 digit
      const op1 = randomInt(1, 9)
      const op2 = randomInt(1, 9)
      await insertQuestion('l2', 'tables', i, 'mul_x', {
        operand1: op1,
        operator: '×',
        operand2: op2,
        answer: op1 * op2
      })
    }

    console.log('[seedQuestions] Generating questions for Level 3...')
    for (let i = 1; i <= 500; i++) {
      // Abacus: 2 or 3 digit, 3 to 4 row vertical zigzag
      const rows = randomInt(3, 4)
      let addends = []
      let sum = 0
      for (let r = 0; r < rows; r++) {
        const digitCount = randomInt(2, 3)
        let val = randomInt(Math.pow(10, digitCount - 1), Math.pow(10, digitCount) - 1)
        if (r > 0 && Math.random() > 0.4) val = -val
        if (r === 0) val = Math.abs(val)
        
        if (sum + val < 0) val = Math.abs(val)
        sum += val
        addends.push(val)
      }
      await insertQuestion('l3', 'abacus', i, 'add', { addends, answer: sum })

      // Visual: 1-digit 10 row OR 2-digit 3 or 4 row
      let visData
      if (Math.random() > 0.5) {
        visData = generateAddends(10, 1, false)
      } else {
        visData = generateAddends(randomInt(3, 4), 2, false)
      }
      await insertQuestion('l3', 'visual', i, 'add', visData)

      // Multiplication: 2-digit x 1-digit
      const m1 = randomInt(10, 99)
      const m2 = randomInt(2, 9)
      await insertQuestion('l3', 'multiplication', i, 'mul_x', {
        operand1: m1,
        operator: '×',
        operand2: m2,
        answer: m1 * m2
      })

      // 2 Steps: 2-digit x 1-digit formatted as e.g. 040 + 12
      const s1 = randomInt(10, 99)
      const s2 = randomInt(2, 9)
      const t = Math.floor(s1 / 10)
      const u = s1 % 10
      const part1 = String(t * 10 * s2).padStart(3, '0')
      const part2 = String(u * s2).padStart(2, '0')
      await insertQuestion('l3', 'two_steps', i, 'two_steps', {
        operand1: s1,
        operator: '×',
        operand2: s2,
        answer_text: `${part1} + ${part2}`
      })
    }

    console.log('[seedQuestions] Generating questions for Level 4...')
    for (let i = 1; i <= 500; i++) {
      // Abacus: 2 or 3 digit, 4 to 6 row vertical
      const rows = randomInt(4, 6)
      let addends = []
      let sum = 0
      for (let r = 0; r < rows; r++) {
        const digitCount = randomInt(2, 3)
        let val = randomInt(Math.pow(10, digitCount - 1), Math.pow(10, digitCount) - 1)
        if (r > 0 && Math.random() > 0.4) val = -val
        if (r === 0) val = Math.abs(val)
        if (sum + val < 0) val = Math.abs(val)
        sum += val
        addends.push(val)
      }
      await insertQuestion('l4', 'abacus', i, 'add', { addends, answer: sum })

      // Visual: 2-digit, 4 to 6 row vertical
      const visData = generateAddends(randomInt(4, 6), 2, false)
      await insertQuestion('l4', 'visual', i, 'add', visData)

      // Multiplication: 2-digit x 1-digit
      const m1 = randomInt(10, 99)
      const m2 = randomInt(2, 9)
      await insertQuestion('l4', 'multiplication', i, 'mul_x', {
        operand1: m1,
        operator: '×',
        operand2: m2,
        answer: m1 * m2
      })

      // Division: 2 or 3 digit by 1 digit (without remainders)
      const q = randomInt(10, 99)
      const divisor = randomInt(2, 9)
      const dividend = q * divisor
      await insertQuestion('l4', 'division', i, 'mul_div', {
        operand1: dividend,
        operator: '÷',
        operand2: divisor,
        answer: q
      })
    }

    console.log('[seedQuestions] Generating questions for Level 5...')
    for (let i = 1; i <= 500; i++) {
      // Abacus: Decimal, 5 to 6 row vertical
      const abacusRows = randomInt(5, 6)
      const abacusData = generateAddends(abacusRows, 2, true)
      await insertQuestion('l5', 'abacus', i, 'add', abacusData)

      // Visual: 2 to 3 digit, 3 to 5 row vertical
      const rows = randomInt(3, 5)
      let addends = []
      let sum = 0
      for (let r = 0; r < rows; r++) {
        const digitCount = randomInt(2, 3)
        let val = randomInt(Math.pow(10, digitCount - 1), Math.pow(10, digitCount) - 1)
        if (r > 0 && Math.random() > 0.4) val = -val
        if (r === 0) val = Math.abs(val)
        if (sum + val < 0) val = Math.abs(val)
        sum += val
        addends.push(val)
      }
      await insertQuestion('l5', 'visual', i, 'add', { addends, answer: sum })

      // Multiplication: 3-digit x 1-digit
      const m1 = randomInt(100, 999)
      const m2 = randomInt(2, 9)
      await insertQuestion('l5', 'multiplication', i, 'mul_x', {
        operand1: m1,
        operator: '×',
        operand2: m2,
        answer: m1 * m2
      })

      // Division: 3 digit by 1 digit (remainder answers 1-2 in 5 questions, so ~30% probability)
      const hasRemainder = i % 5 === 1 || i % 5 === 3
      const divisor = randomInt(2, 9)
      if (hasRemainder) {
        const q = randomInt(20, 150)
        const rem = randomInt(1, divisor - 1)
        const dividend = q * divisor + rem
        await insertQuestion('l5', 'division', i, 'mul_div', {
          operand1: dividend,
          operator: '÷',
          operand2: divisor,
          answer_text: `${q}..${rem}`
        })
      } else {
        const q = randomInt(20, 150)
        const dividend = q * divisor
        await insertQuestion('l5', 'division', i, 'mul_div', {
          operand1: dividend,
          operator: '÷',
          operand2: divisor,
          answer: q
        })
      }
    }

    console.log('[seedQuestions] Generating questions for Level 6...')
    for (let i = 1; i <= 500; i++) {
      // Abacus: Decimal 6-7 rows OR 4-digit 4-5 rows (shuffled)
      let abacusData
      if (Math.random() > 0.5) {
        abacusData = generateAddends(randomInt(6, 7), 2, true)
      } else {
        abacusData = generateAddends(randomInt(4, 5), 4, false)
      }
      await insertQuestion('l6', 'abacus', i, 'add', abacusData)

      // Visual: 2 to 3 digit, 4 to 5 row vertical zigzag
      const rows = randomInt(4, 5)
      let addends = []
      let sum = 0
      for (let r = 0; r < rows; r++) {
        const digitCount = randomInt(2, 3)
        let val = randomInt(Math.pow(10, digitCount - 1), Math.pow(10, digitCount) - 1)
        if (r > 0 && Math.random() > 0.4) val = -val
        if (r === 0) val = Math.abs(val)
        if (sum + val < 0) val = Math.abs(val)
        sum += val
        addends.push(val)
      }
      await insertQuestion('l6', 'visual', i, 'add', { addends, answer: sum })

      // Multiplication: 4 digit x 1 digit
      const m1 = randomInt(1000, 9999)
      const m2 = randomInt(2, 9)
      await insertQuestion('l6', 'multiplication', i, 'mul_x', {
        operand1: m1,
        operator: '×',
        operand2: m2,
        answer: m1 * m2
      })

      // Division: 4 digit by 1 digit (without remainders)
      const q = randomInt(100, 999)
      const divisor = randomInt(2, 9)
      const dividend = q * divisor
      await insertQuestion('l6', 'division', i, 'mul_div', {
        operand1: dividend,
        operator: '÷',
        operand2: divisor,
        answer: q
      })
    }

    console.log('[seedQuestions] Generating questions for Level 7...')
    for (let i = 1; i <= 500; i++) {
      // Abacus: 5 digit, 3 rows vertical
      const abacusData = generateAddends(3, 5, false)
      await insertQuestion('l7', 'abacus', i, 'add', abacusData)

      // Visual: Decimal, 3 to 4 row vertical
      const visualData = generateAddends(randomInt(3, 4), 2, true)
      await insertQuestion('l7', 'visual', i, 'add', visualData)

      // Multiplication: 2 digit x 2 digit
      const m1 = randomInt(10, 99)
      const m2 = randomInt(10, 99)
      await insertQuestion('l7', 'multiplication', i, 'mul_x', {
        operand1: m1,
        operator: '×',
        operand2: m2,
        answer: m1 * m2
      })

      // Division: 3 or 4-digit by 2-digit (without remainders)
      const q = randomInt(10, 99)
      const divisor = randomInt(10, 99)
      const dividend = q * divisor
      await insertQuestion('l7', 'division', i, 'mul_div', {
        operand1: dividend,
        operator: '÷',
        operand2: divisor,
        answer: q
      })

      // 2 Steps: 2-digit x 2-digit, answer format e.g. 0520 + 052
      const s1 = randomInt(10, 99)
      const s2 = randomInt(10, 99)
      const tb = Math.floor(s2 / 10)
      const ub = s2 % 10
      const part1 = String(s1 * tb * 10).padStart(4, '0')
      const part2 = String(s1 * ub).padStart(3, '0')
      await insertQuestion('l7', 'two_steps', i, 'two_steps', {
        operand1: s1,
        operator: '×',
        operand2: s2,
        answer_text: `${part1} + ${part2}`
      })
    }

    console.log('[seedQuestions] Generating questions for Level 8...')
    for (let i = 1; i <= 500; i++) {
      // Abacus: 4 or 5 digit, 4 row, zigzag pattern (no negative answers)
      const abacusRows = 4
      let abacusAddends = []
      let abacusSum = 0
      for (let r = 0; r < abacusRows; r++) {
        const digitCount = randomInt(4, 5)
        let val = randomInt(Math.pow(10, digitCount - 1), Math.pow(10, digitCount) - 1)
        if (r > 0 && Math.random() > 0.4) val = -val
        if (r === 0) val = Math.abs(val)
        if (abacusSum + val < 0) val = Math.abs(val)
        abacusSum += val
        abacusAddends.push(val)
      }
      await insertQuestion('l8', 'abacus', i, 'add', { addends: abacusAddends, answer: abacusSum })

      // Visual: Decimal, 3 to 4 row, vertical questions (both addition and subtraction mixed, NO NEGATIVE ANSWERS)
      const visualRows = randomInt(3, 4)
      const visualData = generateAddends(visualRows, 2, true)
      await insertQuestion('l8', 'visual', i, 'add', visualData)

      // Multiplication: 2-digit x 2-digit
      const m1 = randomInt(10, 99)
      const m2 = randomInt(10, 99)
      await insertQuestion('l8', 'multiplication', i, 'mul_x', {
        operand1: m1,
        operator: '×',
        operand2: m2,
        answer: m1 * m2
      })

      // Division: 4-digit by 2-digit (without remainders)
      const divisor = randomInt(10, 99)
      const minQ = Math.ceil(1000 / divisor)
      const maxQ = Math.floor(9999 / divisor)
      const q = randomInt(minQ, maxQ)
      const dividend = q * divisor
      await insertQuestion('l8', 'division', i, 'mul_div', {
        operand1: dividend,
        operator: '÷',
        operand2: divisor,
        answer: q
      })
    }

    console.log(`[seedQuestions] Done! Total questions inserted: ${totalUpserted}`)
  } catch (err) {
    console.error('[seedQuestions] Seeding failed:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
