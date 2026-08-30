import 'dotenv/config';
import pool from './db.js';

async function fetchSoumyaAll() {
  try {
    const res = await pool.query("SELECT day_number, completed, section_data FROM day_records WHERE student_id = 25 ORDER BY day_number");
    console.log(res.rows.map(r => `Day ${r.day_number}: completed=${r.completed}, sections=${r.section_data ? Object.keys(r.section_data).join(',') : 'none'}`).join('\n'));
  } finally {
    await pool.end();
  }
}
fetchSoumyaAll();
