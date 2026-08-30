import 'dotenv/config';
import pool from './db.js';

async function checkSoumyaDay() {
  try {
    const res = await pool.query("SELECT day_number, section_data, completed FROM day_records WHERE student_id = 25 AND day_number = 1");
    console.log("Day 1 data:", JSON.stringify(res.rows[0], null, 2));
    
    const res2 = await pool.query("SELECT day_number, section_data, completed FROM day_records WHERE student_id = 25 AND day_number = 15");
    console.log("Day 15 data:", JSON.stringify(res2.rows[0], null, 2));

    const res3 = await pool.query("SELECT day_number, section_data, completed FROM day_records WHERE student_id = 25 AND day_number = 30");
    console.log("Day 30 data:", JSON.stringify(res3.rows[0], null, 2));
  } finally {
    await pool.end();
  }
}
checkSoumyaDay();
