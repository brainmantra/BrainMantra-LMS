import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('backend/.env') });

const db = await import('../backend/db.js');
const pool = db.default;
const qs = await import('../backend/utils/questionSelector.js');

async function run() {
  try {
    const qsArr = await qs.selectQuestionsForDay('l3', 'multiplication', 15);
    console.log(qsArr);
    
    let validQs = 0;
    for (const q of qsArr) {
      let hasContent = false;
      try {
        const raw = typeof q.question === 'string' ? JSON.parse(q.question) : q.question;
        if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) hasContent = true;
      } catch(e) {}
      
      const qText = typeof q.question === 'string' ? q.question.trim() : (q.question_text || q.questionText || '').trim();
      const img = (q.image || '').trim();
      if (qText !== '' || img !== '' || hasContent) validQs++;
    }
    console.log('validQs:', validQs);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
