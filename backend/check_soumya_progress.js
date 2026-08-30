import 'dotenv/config';
import pool from './db.js';

async function fetchSoumyaProgress() {
  try {
    const res = await pool.query("SELECT day_number, opened, completed, reset_at, section_data FROM day_records WHERE student_id = 25 ORDER BY day_number");
    console.log("Total days fetched:", res.rows.length);
    console.log("Day 1:", JSON.stringify(res.rows[0], null, 2));
    console.log("Day 2:", JSON.stringify(res.rows[1], null, 2));
    console.log("Day 20:", JSON.stringify(res.rows[19], null, 2));
  } finally {
    await pool.end();
  }
}
fetchSoumyaProgress();
