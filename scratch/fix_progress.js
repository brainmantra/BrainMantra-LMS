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
    let fixedCount = 0;

    for (const student of students) {
      const studentId = student.id;
      const level = student.level || 'beginner';
      
      const { rows: days } = await pool.query(
        `SELECT * FROM day_records WHERE student_id = $1 AND reset_at IS NOT NULL`,
        [studentId]
      );
      
      for (const row of days) {
        const dayNum = row.day_number;
        const validSections = await qs.getSectionsForLevelAsync(level, dayNum);
        
        let sectionData = {};
        if (row.section_data) {
          sectionData = typeof row.section_data === 'string' ? JSON.parse(row.section_data) : row.section_data;
        }
        const keys = Object.keys(sectionData);
        
        let allDone = false;
        
        if (validSections.length > 0) {
          // If valid sections exist for their current level, check if they did all of them
          allDone = validSections.every(sec => sectionData[sec] && sectionData[sec].status === 'done');
          
          // Fallback: If they did a bunch of sections (e.g. 4) previously and all are done, and it equals or exceeds the number of valid sections, consider it done too to prevent unfair resets
          if (!allDone && keys.length > 0 && keys.length >= validSections.length) {
            allDone = keys.every(sec => sectionData[sec].status === 'done');
          }
        } else {
          // If no valid sections for current level (e.g. level 5), but they have completed sections from a previous level
          if (keys.length > 0) {
            allDone = keys.every(sec => sectionData[sec].status === 'done');
          }
        }

        if (allDone) {
          await pool.query(
            `UPDATE day_records SET completed = true, reset_at = null WHERE id = $1`,
            [row.id]
          );
          fixedCount++;
        }
      }
    }
    
    console.log(`Fixed ${fixedCount} days that were incorrectly reset.`);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
