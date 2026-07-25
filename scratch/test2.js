import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('backend/.env') });

const db = await import('../backend/db.js');
const pool = db.default;

async function run() {
  const { rows } = await pool.query('SELECT * FROM students WHERE id = 36');
  const student = rows[0];
  const level = student.level;
  const qs = await import('../backend/utils/questionSelector.js');
  
  const sections = await qs.getSectionsForLevelAsync(level, 8);
  const validSections = [];
  
  for (const sec of sections) {
    if (qs.TEACHER_INPUT_SECTIONS.has(sec)) {
      const tq = await qs.getTeacherQuestion(level, 8, sec);
      if (!tq || !tq.question) continue;
      let qsArr = typeof tq.question === 'string' ? JSON.parse(tq.question) : tq.question;
      if (!Array.isArray(qsArr)) qsArr = [qsArr];
      if (qsArr.length === 1 && qsArr[0].questions) qsArr = qsArr[0].questions;
      else if (qsArr.length === 1 && qsArr[0].items) qsArr = qsArr[0].items;
      
      let validQs = 0;
      for (const q of qsArr) {
        const qText = (q.question || q.question_text || q.questionText || '').trim();
        const img = (q.image || '').trim();
        if (qText !== '' || img !== '') validQs++;
      }
      if (validQs === 0) continue;
    } else {
      const qsArr = await qs.selectQuestionsForDay(level, sec, 8);
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
      if (validQs === 0) continue;
    }
    validSections.push(sec);
  }
  console.log('level:', level, 'validSections:', validSections);
  process.exit();
}
run();
