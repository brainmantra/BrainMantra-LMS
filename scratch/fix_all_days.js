import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('backend/.env') });

const db = await import('../backend/db.js');
const pool = db.default;
const qs = await import('../backend/utils/questionSelector.js');

async function run() {
  try {
    const { rows: students } = await pool.query('SELECT * FROM students');
    let resetCount = 0;

    for (const student of students) {
      const studentId = student.id;
      const level = student.level || 'beginner';
      
      const { rows: days } = await pool.query(
        `SELECT * FROM day_records WHERE student_id = $1 AND day_number > 0 AND day_number <= 100 AND completed = true`,
        [studentId]
      );
      
      for (const row of days) {
        const dayNum = row.day_number;
        const validSections = await qs.getSectionsForLevelAsync(level, dayNum);
        
        let sectionData = {};
        if (row.section_data) {
          sectionData = typeof row.section_data === 'string' ? JSON.parse(row.section_data) : row.section_data;
        }
        
        const allDone = validSections.length > 0 && validSections.every(sec => sectionData[sec] && sectionData[sec].status === 'done');
        
        if (!allDone) {
          await pool.query(
            `UPDATE day_records SET completed = false, reset_at = NOW() WHERE id = $1`,
            [row.id]
          );
          resetCount++;
        }
      }
    }
    
    console.log(`Swept database: Reset ${resetCount} records across ALL days up to day 100 that were incompletely finished.`);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
