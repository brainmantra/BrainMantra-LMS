import 'dotenv/config'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve('backend/.env') })

import pool from './backend/db.js'
import { getSectionsForLevelAsync, TEACHER_INPUT_SECTIONS, getTeacherQuestion } from './backend/utils/questionSelector.js'

async function run() {
  const level = 'l3' // pick a level from the students list
  const dayNumber = 4
  const section = 'abacus'

  const sectionData = {
    [section]: { status: 'done' }
  }

  const sections = await getSectionsForLevelAsync(level, dayNumber)
  const validSections = []
  for (const sec of sections) {
    if (TEACHER_INPUT_SECTIONS.has(sec)) {
      const tq = await getTeacherQuestion(level, dayNumber, sec)
      if (!tq || !tq.question) continue
      let validQs = 0
      let qs = []
      if (typeof tq.question === 'string') {
        try { qs = JSON.parse(tq.question) } catch(e){}
      } else {
        qs = tq.question
      }
      if (!Array.isArray(qs)) qs = [qs]
      if (qs.length === 1 && qs[0].questions) qs = qs[0].questions
      for (const q of qs) {
        const qText = (q.question || q.question_text || q.questionText || '').trim()
        const img = (q.image || '').trim()
        if (qText !== '' || img !== '') validQs++
      }
      if (validQs === 0) continue
    }
    validSections.push(sec)
  }

  const allDone = validSections.every(sec => sectionData[sec]?.status === 'done')
  console.log('Sections from getSectionsForLevelAsync:', sections)
  console.log('validSections:', validSections)
  console.log('allDone:', allDone)
  process.exit(0)
}
run()
