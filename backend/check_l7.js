import 'dotenv/config';
import pool from './db.js';

async function checkL7() {
  try {
    const res = await pool.query("SELECT DISTINCT section FROM question_bank WHERE level = 'l7'");
    console.log("question_bank sections for l7:", res.rows);
    const res2 = await pool.query("SELECT DISTINCT section FROM teacher_questions WHERE level = 'l7'");
    console.log("teacher_questions sections for l7:", res2.rows);
  } finally {
    await pool.end();
  }
}
checkL7();
