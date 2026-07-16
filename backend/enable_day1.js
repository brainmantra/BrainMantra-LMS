import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const { rows: students } = await pool.query('SELECT id, name FROM students');
    let count = 0;
    
    for (const student of students) {
      const studentId = student.id;
      // Check if Day 1 is completed
      const { rows: dayRows } = await pool.query(
        'SELECT completed FROM day_records WHERE student_id = $1 AND day_number = 1', 
        [studentId]
      );
      
      if (dayRows.length > 0 && dayRows[0].completed) {
        // Already completed, skip
        continue;
      }
      
      if (dayRows.length === 0) {
        // Insert new record
        await pool.query(
          `INSERT INTO day_records (student_id, day_number, opened, reset_at)
           VALUES ($1, 1, false, NOW())`,
          [studentId]
        );
      } else {
        // Update existing record
        await pool.query(
          `UPDATE day_records SET reset_at = NOW() WHERE student_id = $1 AND day_number = 1`,
          [studentId]
        );
      }
      console.log(`Enabled Day 1 for student ${student.name} (${studentId})`);
      count++;
    }
    console.log(`Successfully enabled Day 1 for ${count} students.`);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
