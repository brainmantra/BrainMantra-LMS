import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('backend/.env') });

const db = await import('../backend/db.js');
const pool = db.default;
const dateUtils = await import('../backend/utils/dateHelpers.js');
const { getChallengeDay } = dateUtils;
const qs = await import('../backend/utils/questionSelector.js');
const { getSectionsForLevelAsync, TEACHER_INPUT_SECTIONS, getTeacherQuestion, selectQuestionsForDay } = qs;

async function checkAndResetAllDays() {
  try {
    const { rows: students } = await pool.query('SELECT id, level, registration_date, first_login_date FROM students');
    
    let resetCount = 0;
    let completedCount = 0;

    for (const student of students) {
      const studentId = student.id;
      const level = student.level;
      const currentDay = getChallengeDay(student.first_login_date || student.registration_date);
      
      // We only check PREVIOUS days strictly (< currentDay)
      for (let dayNum = 1; dayNum < currentDay; dayNum++) {
        
        // 1. Calculate validSections
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

        // 2. Fetch day record
        const { rows } = await pool.query(
          `SELECT completed, section_data FROM day_records WHERE student_id = $1 AND day_number = $2`,
          [studentId, dayNum]
        );

        let sectionData = {};
        if (rows.length > 0 && rows[0].section_data) {
          sectionData = typeof rows[0].section_data === 'string' ? JSON.parse(rows[0].section_data) : rows[0].section_data;
        }

        // 3. Check if all valid sections are done
        const allDone = validSections.length > 0 && validSections.every(sec => sectionData[sec] && sectionData[sec].status === 'done');
        
        if (allDone) {
          // If actually done but marked incomplete in DB, fix it
          if (rows.length === 0 || !rows[0].completed) {
            await pool.query(
              `INSERT INTO day_records (student_id, day_number, completed, section_data, opened, updated_at)
               VALUES ($1, $2, TRUE, $3, TRUE, NOW())
               ON CONFLICT (student_id, day_number)
               DO UPDATE SET completed = TRUE, updated_at = NOW()`,
              [studentId, dayNum, JSON.stringify(sectionData)]
            );
            completedCount++;
          }
        } else {
          // Incomplete day! Reset it for 24 hours
          await pool.query(
            `INSERT INTO day_records (student_id, day_number, opened, opened_at, reset_at, completed, section_data, updated_at)
             VALUES ($1, $2, TRUE, NOW(), NOW(), FALSE, $3, NOW())
             ON CONFLICT (student_id, day_number)
             DO UPDATE SET opened = TRUE, reset_at = NOW(), completed = FALSE, updated_at = NOW()`,
            [studentId, dayNum, JSON.stringify(sectionData)]
          );
          resetCount++;
        }
      }

      // Recalculate streak after checking all past days
      const { recalculateStreak } = await import('../backend/utils/streak.js');
      await recalculateStreak(studentId, student.first_login_date || student.registration_date);
    }
    
    console.log(`Successfully completed ${completedCount} days, and reset ${resetCount} incomplete past days for a 24-hour window.`);
  } catch (error) {
    console.error('Error in script:', error);
  } finally {
    process.exit(0);
  }
}

checkAndResetAllDays();
