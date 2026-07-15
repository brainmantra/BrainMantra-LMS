import pool from './db.js';
import { recalculateStreak } from './utils/streak.js';

async function run() {
  console.log('Recalculating streaks for everyone...');
  try {
    const { rows: students } = await pool.query('SELECT id, registration_date FROM students');
    for (const student of students) {
      await recalculateStreak(student.id, student.registration_date);
      console.log(`Recalculated streak for student ${student.id}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
