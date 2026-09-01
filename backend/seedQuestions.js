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
    console.log('[seedQuestions] Clearing existing questions from question_bank...')
    await client.query(`DELETE FROM question_bank`)
    
    let totalUpserted = 0
    const buffer = []

    async function flushBuffer() {
      if (buffer.length === 0) return
      const values = []
      const placeholders = []
      let paramIdx = 1

      for (const row of buffer) {
        placeholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, FALSE)`)
        values.push(
          row.level,
          row.section,
          row.index,
          row.type,
          row.data.addends ? JSON.stringify(row.data.addends) : null,
          row.data.operand1 ?? null,
          row.data.operator ?? null,
          row.data.operand2 ?? null,
          row.data.answer ?? null,
          row.data.answer_text ?? null
        )
      }

      await client.query(
        `INSERT INTO question_bank 
          (level, section, question_index, question_type, addends, operand1, operator, operand2, answer, answer_text, is_teacher_input)
         VALUES ${placeholders.join(', ')}`,
        values
      )
      totalUpserted += buffer.length
      buffer.length = 0
    }

    // Helper to insert question into question_bank (batched)
    async function insertQuestion(level, section, index, type, data) {
      buffer.push({ level, section, index, type, data })
      if (buffer.length >= 200) {
        await flushBuffer()
      }
    }

    // Helper to generate 500 questions (100 days x 5 questions) where all 5 on each day are strictly unique
    async function generateSection(level, section, genFn) {
      let qIdx = 1
      for (let day = 1; day <= 100; day++) {
        const daySet = new Set()
        const dayQuestions = []
        let attempts = 0
        while (dayQuestions.length < 5 && attempts < 200) {
          attempts++
          const item = genFn(day, dayQuestions.length + 1)
          const key = item.key || JSON.stringify(item.data)
          if (!daySet.has(key)) {
            daySet.add(key)
            dayQuestions.push(item)
          }
        }
        while (dayQuestions.length < 5) {
          dayQuestions.push(genFn(day, dayQuestions.length + 1))
        }
        for (const item of dayQuestions) {
          await insertQuestion(level, section, qIdx++, item.type, item.data)
        }
      }
    }

    console.log('[seedQuestions] Generating Beginner & Level 1...')
    await generateSection('beginner', 'abacus', () => {
      const data = generateAddends(randomInt(2, 3), 1, false)
      return { type: 'add', data }
    })
    await generateSection('l1', 'abacus', () => {
      const data = generateAddends(randomInt(3, 5), 1, false)
      return { type: 'add', data }
    })

    console.log('[seedQuestions] Generating Level 2...')
    await generateSection('l2', 'abacus', () => {
      const data = generateAddends(randomInt(4, 5), 2, false)
      return { type: 'add', data }
    })
    await generateSection('l2', 'visual', () => {
      const data = generateAddends(randomInt(6, 7), 1, false)
      return { type: 'add', data }
    })
    await generateSection('l2', 'tables', () => {
      const op1 = randomInt(2, 9)
      const op2 = randomInt(2, 9)
      return { type: 'mul_x', data: { operand1: op1, operator: '×', operand2: op2, answer: op1 * op2 } }
    })

    console.log('[seedQuestions] Generating Level 3...')
    await generateSection('l3', 'abacus', () => {
      const rows = randomInt(3, 4)
      let addends = []
      let sum = 0
      for (let r = 0; r < rows; r++) {
        const digitCount = randomInt(2, 3)
        let val = randomInt(Math.pow(10, digitCount - 1), Math.pow(10, digitCount) - 1)
        if (r > 0 && Math.random() > 0.4) val = -val
        if (r === 0 || sum + val < 0) val = Math.abs(val)
        sum += val
        addends.push(val)
      }
      return { type: 'add', data: { addends, answer: sum } }
    })
    await generateSection('l3', 'visual', () => {
      const data = Math.random() > 0.5 ? generateAddends(10, 1, false) : generateAddends(randomInt(3, 4), 2, false)
      return { type: 'add', data }
    })
    await generateSection('l3', 'multiplication', () => {
      const m1 = randomInt(10, 99)
      const m2 = randomInt(2, 9)
      return { type: 'mul_x', data: { operand1: m1, operator: '×', operand2: m2, answer: m1 * m2 } }
    })
    await generateSection('l3', 'two_steps', () => {
      const s1 = randomInt(10, 99)
      const s2 = randomInt(2, 9)
      const t = Math.floor(s1 / 10)
      const u = s1 % 10
      const part1 = String(t * 10 * s2).padStart(3, '0')
      const part2 = String(u * s2).padStart(2, '0')
      return { type: 'two_steps', data: { operand1: s1, operator: '×', operand2: s2, answer_text: `${part1} + ${part2}` } }
    })

    console.log('[seedQuestions] Generating Level 4...')
    await generateSection('l4', 'abacus', () => {
      const rows = randomInt(4, 6)
      let addends = []
      let sum = 0
      for (let r = 0; r < rows; r++) {
        const digitCount = randomInt(2, 3)
        let val = randomInt(Math.pow(10, digitCount - 1), Math.pow(10, digitCount) - 1)
        if (r > 0 && Math.random() > 0.4) val = -val
        if (r === 0 || sum + val < 0) val = Math.abs(val)
        sum += val
        addends.push(val)
      }
      return { type: 'add', data: { addends, answer: sum } }
    })
    await generateSection('l4', 'visual', () => {
      const data = generateAddends(randomInt(4, 6), 2, false)
      return { type: 'add', data }
    })
    await generateSection('l4', 'multiplication', () => {
      const m1 = randomInt(10, 99)
      const m2 = randomInt(2, 9)
      return { type: 'mul_x', data: { operand1: m1, operator: '×', operand2: m2, answer: m1 * m2 } }
    })
    await generateSection('l4', 'division', () => {
      const q = randomInt(10, 99)
      const divisor = randomInt(2, 9)
      const dividend = q * divisor
      return { type: 'mul_div', data: { operand1: dividend, operator: '÷', operand2: divisor, answer: q } }
    })

    console.log('[seedQuestions] Generating Level 5...')
    await generateSection('l5', 'abacus', () => {
      const data = generateAddends(randomInt(5, 6), 2, true)
      return { type: 'add', data }
    })
    await generateSection('l5', 'visual', () => {
      const rows = randomInt(3, 5)
      let addends = []
      let sum = 0
      for (let r = 0; r < rows; r++) {
        const digitCount = randomInt(2, 3)
        let val = randomInt(Math.pow(10, digitCount - 1), Math.pow(10, digitCount) - 1)
        if (r > 0 && Math.random() > 0.4) val = -val
        if (r === 0 || sum + val < 0) val = Math.abs(val)
        sum += val
        addends.push(val)
      }
      return { type: 'add', data: { addends, answer: sum } }
    })
    await generateSection('l5', 'multiplication', () => {
      const m1 = randomInt(100, 999)
      const m2 = randomInt(2, 9)
      return { type: 'mul_x', data: { operand1: m1, operator: '×', operand2: m2, answer: m1 * m2 } }
    })
    await generateSection('l5', 'division', (day, qNum) => {
      const hasRemainder = qNum % 2 === 1
      const divisor = randomInt(2, 9)
      if (hasRemainder) {
        const q = randomInt(20, 150)
        const rem = randomInt(1, divisor - 1)
        const dividend = q * divisor + rem
        return { type: 'mul_div', data: { operand1: dividend, operator: '÷', operand2: divisor, answer_text: `${q}..${rem}` } }
      } else {
        const q = randomInt(20, 150)
        const dividend = q * divisor
        return { type: 'mul_div', data: { operand1: dividend, operator: '÷', operand2: divisor, answer: q } }
      }
    })

    console.log('[seedQuestions] Generating Level 6...')
    await generateSection('l6', 'abacus', () => {
      const data = Math.random() > 0.5 ? generateAddends(randomInt(6, 7), 2, true) : generateAddends(randomInt(4, 5), 4, false)
      return { type: 'add', data }
    })
    await generateSection('l6', 'visual', () => {
      const rows = randomInt(4, 5)
      let addends = []
      let sum = 0
      for (let r = 0; r < rows; r++) {
        const digitCount = randomInt(2, 3)
        let val = randomInt(Math.pow(10, digitCount - 1), Math.pow(10, digitCount) - 1)
        if (r > 0 && Math.random() > 0.4) val = -val
        if (r === 0 || sum + val < 0) val = Math.abs(val)
        sum += val
        addends.push(val)
      }
      return { type: 'add', data: { addends, answer: sum } }
    })
    await generateSection('l6', 'multiplication', () => {
      const m1 = randomInt(1000, 9999)
      const m2 = randomInt(2, 9)
      return { type: 'mul_x', data: { operand1: m1, operator: '×', operand2: m2, answer: m1 * m2 } }
    })
    await generateSection('l6', 'division', () => {
      const q = randomInt(100, 999)
      const divisor = randomInt(2, 9)
      const dividend = q * divisor
      return { type: 'mul_div', data: { operand1: dividend, operator: '÷', operand2: divisor, answer: q } }
    })

    console.log('[seedQuestions] Generating Level 7...')
    await generateSection('l7', 'abacus', () => {
      const data = generateAddends(3, 5, false)
      return { type: 'add', data }
    })
    await generateSection('l7', 'visual', () => {
      const data = generateAddends(randomInt(3, 4), 2, true)
      return { type: 'add', data }
    })
    await generateSection('l7', 'multiplication', () => {
      const m1 = randomInt(10, 99)
      const m2 = randomInt(10, 99)
      return { type: 'mul_x', data: { operand1: m1, operator: '×', operand2: m2, answer: m1 * m2 } }
    })
    await generateSection('l7', 'division', () => {
      const q = randomInt(10, 99)
      const divisor = randomInt(10, 99)
      const dividend = q * divisor
      return { type: 'mul_div', data: { operand1: dividend, operator: '÷', operand2: divisor, answer: q } }
    })
    await generateSection('l7', 'two_steps', () => {
      const s1 = randomInt(10, 99)
      const s2 = randomInt(10, 99)
      const tb = Math.floor(s2 / 10)
      const ub = s2 % 10
      const part1 = String(s1 * tb * 10).padStart(4, '0')
      const part2 = String(s1 * ub).padStart(3, '0')
      return { type: 'two_steps', data: { operand1: s1, operator: '×', operand2: s2, answer_text: `${part1} + ${part2}` } }
    })

    console.log('[seedQuestions] Generating Level 8...')
    await generateSection('l8', 'abacus', () => {
      const rows = 4
      let addends = []
      let sum = 0
      for (let r = 0; r < rows; r++) {
        const digitCount = randomInt(4, 5)
        let val = randomInt(Math.pow(10, digitCount - 1), Math.pow(10, digitCount) - 1)
        if (r > 0 && Math.random() > 0.4) val = -val
        if (r === 0 || sum + val < 0) val = Math.abs(val)
        sum += val
        addends.push(val)
      }
      return { type: 'add', data: { addends, answer: sum } }
    })
    await generateSection('l8', 'visual', () => {
      const data = generateAddends(randomInt(3, 4), 2, true)
      return { type: 'add', data }
    })
    await generateSection('l8', 'multiplication', () => {
      const m1 = randomInt(10, 99)
      const m2 = randomInt(10, 99)
      return { type: 'mul_x', data: { operand1: m1, operator: '×', operand2: m2, answer: m1 * m2 } }
    })
    await generateSection('l8', 'division', () => {
      const divisor = randomInt(10, 99)
      const minQ = Math.ceil(1000 / divisor)
      const maxQ = Math.floor(9999 / divisor)
      const q = randomInt(minQ, maxQ)
      const dividend = q * divisor
      return { type: 'mul_div', data: { operand1: dividend, operator: '÷', operand2: divisor, answer: q } }
    })

    console.log('[seedQuestions] Generating Alumni & GM...')
    await generateSection('alumni', 'abacus', () => {
      const rows = 5
      let addends = []
      let sum = 0
      for (let r = 0; r < rows; r++) {
        const digitCount = randomInt(4, 5)
        let val = randomInt(Math.pow(10, digitCount - 1), Math.pow(10, digitCount) - 1)
        if (r > 0 && Math.random() > 0.4) val = -val
        if (r === 0 || sum + val < 0) val = Math.abs(val)
        sum += val
        addends.push(val)
      }
      return { type: 'add', data: { addends, answer: sum } }
    })
    await generateSection('gm', 'abacus', () => {
      const rows = 5
      let addends = []
      let sum = 0
      for (let r = 0; r < rows; r++) {
        const digitCount = randomInt(4, 5)
        let val = randomInt(Math.pow(10, digitCount - 1), Math.pow(10, digitCount) - 1)
        if (r > 0 && Math.random() > 0.4) val = -val
        if (r === 0 || sum + val < 0) val = Math.abs(val)
        sum += val
        addends.push(val)
      }
      return { type: 'add', data: { addends, answer: sum } }
    })

    await flushBuffer()

    console.log(`[seedQuestions] Done! Total questions inserted: ${totalUpserted}`)
  } catch (err) {
    console.error('[seedQuestions] Seeding failed:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
