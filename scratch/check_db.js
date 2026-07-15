import 'dotenv/config';
import pool from '../backend/db.js';

async function run() {
  const {rows} = await pool.query('SELECT level, section, count(*) FROM question_bank GROUP BY level, section');
  console.table(rows);
  
  const {rows: tRows} = await pool.query('SELECT level, section, count(*) FROM teacher_questions GROUP BY level, section');
  console.table(tRows);
  
  process.exit(0);
}
run();
