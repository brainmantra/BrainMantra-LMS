import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('backend/.env') });

const db = await import('../backend/db.js');
const pool = db.default;
const qs = await import('../backend/utils/questionSelector.js');
const { TEACHER_INPUT_SECTIONS, getTeacherQuestion, getSectionsForLevelAsync, selectQuestionsForDay } = qs;

async function run() {
  try {
    const { rows: students } = await pool.query('SELECT * FROM students');
    let restoredCount = 0;

    for (const student of students) {
      const studentId = student.id;
      const level = student.level || 'beginner';
      
      const { rows: days } = await pool.query(
        `SELECT * FROM day_records WHERE student_id = $1 AND completed = false AND section_data IS NOT NULL`,
        [studentId]
      );
      
      for (const row of days) {
        const dayNum = row.day_number;
        const sections = await getSectionsForLevelAsync(level, dayNum);
        const validSections = [];
        
        for (const sec of sections) {
          if (TEACHER_INPUT_SECTIONS.has(sec)) {
            const tq = await getTeacherQuestion(level, dayNum, sec);
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
            const qsArr = await selectQuestionsForDay(level, sec, dayNum);
            if (qsArr.length === 0) continue;
          }
          validSections.push(sec);
        }
        
        let sectionData = {};
        if (row.section_data) {
          sectionData = typeof row.section_data === 'string' ? JSON.parse(row.section_data) : row.section_data;
        }
        
        const allDone = validSections.length > 0 && validSections.every(sec => sectionData[sec] && sectionData[sec].status === 'done');
        
        if (allDone) {
          await pool.query(
            `UPDATE day_records SET completed = true, reset_at = NULL WHERE id = $1`,
            [row.id]
          );
          restoredCount++;
        }
      }
    }
    
    console.log(`Restored ${restoredCount} incorrectly reset records.`);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
