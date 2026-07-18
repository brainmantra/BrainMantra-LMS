import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve('backend/.env') })

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
})

async function run() {
  const day = 4;
  console.log(`Resetting progress for Day ${day}...`);

  // 1. Get all students
  const { rows: students } = await pool.query('SELECT * FROM students');
  console.log(`Found ${students.length} students`);

  // 2. Delete from day_records
  const resDay = await pool.query('DELETE FROM day_records WHERE day_number = $1 RETURNING student_id', [day]);
  console.log(`Deleted ${resDay.rowCount} records from day_records`);

  const tables = [
    'responses_l1', 'responses_l2', 'responses_l3', 'responses_l4',
    'responses_l5', 'responses_l6', 'responses_l7', 'responses_l8',
    'responses_alumni', 'responses_beginner', 'responses_gm'
  ];

  // 3. Delete from responses and track XP to deduct
  const studentDeductions = {};
  for (const table of tables) {
    try {
      const { rows: deletedResponses } = await pool.query(
        `DELETE FROM ${table} WHERE day_number = $1 RETURNING student_id, xp_earned`,
        [day]
      );
      if (deletedResponses.length > 0) {
        console.log(`Deleted ${deletedResponses.length} records from ${table}`);
        for (const row of deletedResponses) {
          if (!studentDeductions[row.student_id]) studentDeductions[row.student_id] = 0;
          studentDeductions[row.student_id] += (row.xp_earned || 0);
        }
      }
    } catch (e) {
      // Table might not exist or error
    }
  }

  // 4. Update XP for each student
  for (const studentId of Object.keys(studentDeductions)) {
    const xpToDeduct = studentDeductions[studentId];
    if (xpToDeduct > 0) {
      await pool.query(
        `UPDATE students SET xp_total = GREATEST(0, xp_total - $1) WHERE id = $2`,
        [xpToDeduct, studentId]
      );
      console.log(`Deducted ${xpToDeduct} XP from student ${studentId}`);
    }
  }

  console.log('Reset complete!');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
