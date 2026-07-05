/**
 * seed.js — One-time script to populate question_bank from Magic QP with paper no. 2023.xlsx
 *   cd backend && node seed.js
 *
 * Safe to re-run (upserts on UNIQUE constraint level+section+question_index).
 */
import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import pool from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const XLS_PATH = path.join(__dirname, '..', 'Magic QP with paper no. 2023.xlsx')

// ── Level-to-sheet mapping ─────────────────────────────────────────────────────
// For each level: which ADD sheet, split index (abacus/visual boundary), which MUL sheet
const LEVEL_CONFIG = {
  l1: { addSheet: '1 ADD', abacusRange: [1, 40], visualRange: null,    mulSheet: null,   divSheet: null },
  l2: { addSheet: '2 ADD', abacusRange: [1, 40], visualRange: [41, 83], mulSheet: null,   divSheet: null },
  l3: { addSheet: '3 ADD', abacusRange: [1, 40], visualRange: [41, 83], mulSheet: null,   divSheet: null },
  l4: { addSheet: '4 ADD ', abacusRange: [1, 40], visualRange: [41, 80], mulSheet: '4 MUL', divSheet: '5 DIV' },
  l5: { addSheet: '5 ADD', abacusRange: [1, 47], visualRange: [48, 94], mulSheet: ' 5 MUL ', divSheet: '5 DIV' },
  l6: { addSheet: '6 ADD', abacusRange: [1, 46], visualRange: [47, 93], mulSheet: '6MUL',  divSheet: '6MUL' },
  l7: { addSheet: '7 ADD', abacusRange: [1, 45], visualRange: [46, 90], mulSheet: '7MUL',  divSheet: '7MUL' },
  l8: { addSheet: '8ADD',  abacusRange: [1, 30], visualRange: [31, 60], mulSheet: '8 MUL', divSheet: '8 MUL' },
}

// ── Parse ADD sheet ────────────────────────────────────────────────────────────
// ADD sheets: column-based. Each column = one question.
// Row 4 (0-indexed row 3) = question numbers.
// Rows 5–N = addends per column.
// Columns 0–19 = question paper; Columns 20–39 = answer paper (we skip answers, compute ourselves).
function parseAddSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName]
  if (!ws) {
    console.warn(`  [WARN] Sheet "${sheetName}" not found.`)
    return []
  }

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
  const totalRows = range.e.r + 1
  const totalCols = range.e.c + 1

  const questions = []

  // Only process left half (question paper columns: 0–19)
  const maxQCols = Math.min(20, totalCols)

  for (let col = 0; col < maxQCols; col++) {
    // Row 3 (0-indexed) = question number header
    const qNumCell = ws[XLSX.utils.encode_cell({ r: 3, c: col })]
    const qNum = qNumCell ? Number(qNumCell.v) : null
    if (!qNum || isNaN(qNum)) continue

    // Rows 4+ = addends
    const addends = []
    for (let row = 4; row < totalRows; row++) {
      const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })]
      if (cell === undefined || cell === null || cell.v === undefined || cell.v === '') continue
      const val = Number(cell.v)
      if (!isNaN(val)) addends.push(val)
    }

    if (addends.length === 0) continue

    const answer = addends.reduce((sum, v) => sum + v, 0)
    // Round to 2 decimal places to handle floating point
    const roundedAnswer = Math.round(answer * 100) / 100

    questions.push({
      questionNumber: qNum,
      addends,
      answer: roundedAnswer,
    })
  }

  return questions
}

// ── Parse MUL sheet ────────────────────────────────────────────────────────────
// MUL sheets: row-based. Each row = one question.
// Left question: cols 0(Q#), 1(op1), 2(operator), 3(op2), 4(=)
// Right question: cols 7(Q#), 8(op1), 9(operator), 10(op2), 11(=)
function parseMulSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName]
  if (!ws) {
    console.warn(`  [WARN] Sheet "${sheetName}" not found.`)
    return []
  }

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
  const totalRows = range.e.r + 1

  const questions = []

  for (let row = 0; row < totalRows; row++) {
    // Try left question (cols 0-4)
    for (const startCol of [0, 7]) {
      const qNumCell = ws[XLSX.utils.encode_cell({ r: row, c: startCol })]
      const op1Cell  = ws[XLSX.utils.encode_cell({ r: row, c: startCol + 1 })]
      const opCell   = ws[XLSX.utils.encode_cell({ r: row, c: startCol + 2 })]
      const op2Cell  = ws[XLSX.utils.encode_cell({ r: row, c: startCol + 3 })]

      if (!qNumCell || !op1Cell || !opCell || !op2Cell) continue

      const qNum = Number(qNumCell.v)
      const op1  = Number(op1Cell.v)
      const opStr = String(opCell.v || '').trim()
      const op2  = Number(op2Cell.v)

      if (isNaN(qNum) || isNaN(op1) || isNaN(op2)) continue
      if (opStr !== '×' && opStr !== '÷' && opStr !== 'x' && opStr !== '/') continue

      // Normalize operator
      const operator = (opStr === 'x' || opStr === '×') ? '×' : '÷'

      let answer
      if (operator === '×') {
        answer = Math.round(op1 * op2 * 1000) / 1000
      } else {
        answer = op2 !== 0 ? Math.round((op1 / op2) * 1000) / 1000 : null
      }

      if (answer === null) continue

      questions.push({
        questionNumber: qNum,
        operand1: op1,
        operator,
        operand2: op2,
        answer,
      })
    }
  }

  return questions
}

// ── Upsert one question into question_bank ─────────────────────────────────────
async function upsertQuestion(client, params) {
  await client.query(
    `INSERT INTO question_bank
       (level, section, question_index, question_type,
        addends, operand1, operator, operand2, answer,
        source_sheet, source_question_number, is_teacher_input)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,FALSE)
     ON CONFLICT (level, section, question_index)
     DO UPDATE SET
       question_type          = EXCLUDED.question_type,
       addends                = EXCLUDED.addends,
       operand1               = EXCLUDED.operand1,
       operator               = EXCLUDED.operator,
       operand2               = EXCLUDED.operand2,
       answer                 = EXCLUDED.answer,
       source_sheet           = EXCLUDED.source_sheet,
       source_question_number = EXCLUDED.source_question_number,
       updated_at             = NOW()`,
    params
  )
}

// ── Main seed function ─────────────────────────────────────────────────────────
async function seed() {
  console.log(`[seed] Reading: ${XLS_PATH}`)

  let wb
  try {
    wb = XLSX.readFile(XLS_PATH)
  } catch (err) {
    console.error('[seed] ✗ Could not open Excel file:', err.message)
    process.exit(1)
  }

  console.log('[seed] Sheets found:', wb.SheetNames.join(', '))

  const client = await pool.connect()
  let totalInserted = 0

  try {
    for (const [level, cfg] of Object.entries(LEVEL_CONFIG)) {
      console.log(`\n[seed] Processing level ${level.toUpperCase()} (${cfg.addSheet})...`)

      // ── ADD sheet: Abacus section ────────────────────────────────────────────
      const addQs = parseAddSheet(wb, cfg.addSheet)
      console.log(`  ADD questions found: ${addQs.length}`)

      for (const q of addQs) {
        const qIdx = q.questionNumber
        const [absStart, absEnd] = cfg.abacusRange

        if (qIdx >= absStart && qIdx <= absEnd) {
          // Abacus section
          await upsertQuestion(client, [
            level, 'abacus', qIdx, 'add',
            JSON.stringify(q.addends), null, null, null, q.answer,
            cfg.addSheet, qIdx, 
          ])
          totalInserted++
        }

        if (cfg.visualRange) {
          const [visStart, visEnd] = cfg.visualRange
          if (qIdx >= visStart && qIdx <= visEnd) {
            // Visual section (same data, different section name)
            await upsertQuestion(client, [
              level, 'visual', qIdx, 'add',
              JSON.stringify(q.addends), null, null, null, q.answer,
              cfg.addSheet, qIdx,
            ])
            totalInserted++
          }
        }
      }

      // ── MUL sheet: Multiplication + Division sections ────────────────────────
      if (cfg.mulSheet) {
        const mulQs = parseMulSheet(wb, cfg.mulSheet)
        console.log(`  MUL questions found (${cfg.mulSheet}): ${mulQs.length}`)

        let mulIdx = 0
        let divIdx = 0

        for (const q of mulQs) {
          if (q.operator === '×') {
            mulIdx++
            await upsertQuestion(client, [
              level, 'multiplication', mulIdx, 'mul_x',
              null, q.operand1, q.operator, q.operand2, q.answer,
              cfg.mulSheet, q.questionNumber,
            ])
            totalInserted++
          } else if (q.operator === '÷') {
            // For l4: division uses divSheet (5 MUL), which may differ from mulSheet
            divIdx++
            const divLevel = level  // same level
            await upsertQuestion(client, [
              divLevel, 'division', divIdx, 'mul_div',
              null, q.operand1, q.operator, q.operand2, q.answer,
              cfg.mulSheet, q.questionNumber,
            ])
            totalInserted++
          }
        }
      }

      // ── Level 4: Division uses 5 MUL sheet (different from mul sheet 4 MUL) ──
      if (level === 'l4' && cfg.divSheet !== cfg.mulSheet) {
        const divQs = parseMulSheet(wb, cfg.divSheet)
        console.log(`  DIV questions found (${cfg.divSheet}): ${divQs.filter(q => q.operator === '÷').length}`)

        let divIdx = 0
        for (const q of divQs) {
          if (q.operator === '÷') {
            divIdx++
            await upsertQuestion(client, [
              level, 'division', divIdx, 'mul_div',
              null, q.operand1, q.operator, q.operand2, q.answer,
              cfg.divSheet, q.questionNumber,
            ])
            totalInserted++
          }
        }
      }

      console.log(`  ✓ Level ${level} done.`)
    }

    console.log(`\n[seed] ✓ Complete. Total rows upserted: ${totalInserted}`)
  } catch (err) {
    console.error('[seed] ✗ Error during seeding:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
