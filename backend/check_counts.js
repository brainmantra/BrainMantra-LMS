import 'dotenv/config';
import pool from './db.js';

async function checkQuestionCounts() {
  try {
    const res = await pool.query("SELECT section, COUNT(*) FROM question_bank WHERE level = 'l7' GROUP BY section");
    console.log(res.rows);
  } finally {
    await pool.end();
  }
}
checkQuestionCounts();
