import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('backend/.env') });

const db = await import('../backend/db.js');
const pool = db.default;

async function retroactivelyCompleteDays() {
  try {
    const { rows: students } = await pool.query('SELECT id, xp_total, first_login_date, registration_date FROM students');
    
    let updatedDays = 0;
    
    for (const student of students) {
      const studentId = student.id;
      
      for (let dayNum = 1; dayNum <= 8; dayNum++) {
        // Fetch day record
        const { rows } = await pool.query(
          `SELECT completed, section_data FROM day_records WHERE student_id = $1 AND day_number = $2`,
          [studentId, dayNum]
        );

        if (rows.length > 0) {
          const record = rows[0];
          let sectionData = {};
          if (record.section_data) {
            sectionData = typeof record.section_data === 'string' ? JSON.parse(record.section_data) : record.section_data;
          }

          // Check if at least one section is 'done'
          const sections = Object.values(sectionData);
          const hasAttempted = sections.some(sec => sec.status === 'done');

          if (hasAttempted && !record.completed) {
            // It has attempts but is not marked completed. Let's complete it.
            let totalMarks = 0, totalXp = 0, totalTime = 0;
            
            for (const sec of Object.values(sectionData)) {
              if (sec.status === 'done') {
                totalMarks += sec.marks || 0;
                totalXp += sec.xpEarned || 0;
                totalTime += sec.timeTaken || 0;
              }
            }

            // Streak Bonus calculation
            const streakBonus = 5;
            totalXp += streakBonus;

            // Update day_records
            await pool.query(
              `UPDATE day_records 
               SET completed = TRUE, 
                   xp_earned = $1, 
                   total_marks = $2, 
                   time_taken_seconds = $3,
                   updated_at = NOW()
               WHERE student_id = $4 AND day_number = $5`,
              [totalXp, totalMarks, Math.round(totalTime), studentId, dayNum]
            );

            // Give them the streak bonus in their global XP (their section XP is already added when they submitted the section)
            await pool.query(
              `UPDATE students SET xp_total = xp_total + $1, updated_at = NOW() WHERE id = $2`,
              [streakBonus, studentId]
            );

            updatedDays++;
          }
        }
      }
      
      // Recalculate streak at the end of checking this student
      const { recalculateStreak } = await import('../backend/utils/streak.js');
      await recalculateStreak(studentId, student.first_login_date || student.registration_date);
    }
    
    console.log(`Successfully marked ${updatedDays} partial days as completed and updated XP/Streak.`);
  } catch (error) {
    console.error('Error in script:', error);
  } finally {
    process.exit(0);
  }
}

retroactivelyCompleteDays();
