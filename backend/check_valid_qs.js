import 'dotenv/config';
import pool from './db.js';
import { selectQuestionsForDay } from './utils/questionSelector.js';

async function checkValidQs() {
  try {
    const qs = await selectQuestionsForDay('l7', 'visual', 20);
    console.log("QS LENGTH:", qs.length);
    let validQs = 0;
    for (const q of qs) {
      let hasContent = false
      try {
        const raw = typeof q.question === 'string' ? JSON.parse(q.question) : q.question
        if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) hasContent = true
      } catch(e) {}
      
      const qText = typeof q.question === 'string' ? q.question.trim() : (q.question_text || q.questionText || '').trim()
      const img = (q.image || '').trim()
      if (qText !== '' || img !== '' || hasContent) validQs++
    }
    console.log("Valid Qs calculated:", validQs);
    console.log("Sample question:", qs[0]);
  } finally {
    await pool.end();
  }
}
checkValidQs();
