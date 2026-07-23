import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('backend/.env') });

const db = await import('../backend/db.js');
const pool = db.default;

async function resetMissedDays() {
  try {
    const { rows: students } = await pool.query('SELECT id FROM students');
    
    let updatedCount = 0;

    for (const student of students) {
      const studentId = student.id;
      for (let dayNum = 1; dayNum <= 5; dayNum++) {
        const { rows } = await pool.query(
          `SELECT completed FROM day_records WHERE student_id = $1 AND day_number = $2`,
          [studentId, dayNum]
        );

        if (rows.length === 0 || !rows[0].completed) {
          await pool.query(
            `INSERT INTO day_records (student_id, day_number, opened, opened_at, reset_at, updated_at)
             VALUES ($1, $2, TRUE, NOW(), NOW(), NOW())
             ON CONFLICT (student_id, day_number)
             DO UPDATE SET opened = TRUE, reset_at = NOW(), updated_at = NOW()`,
            [studentId, dayNum]
          );
          updatedCount++;
        }
      }
    }
    console.log(`Successfully reset ${updatedCount} missed day records for 24 hours.`);
  } catch (error) {
    console.error('Error resetting missed days:', error);
  } finally {
    process.exit(0);
  }
}

resetMissedDays();
