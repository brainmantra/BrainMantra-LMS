import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('backend/.env') });

const db = await import('../backend/db.js');
const pool = db.default;

async function run() {
  try {
    const res = await pool.query("SELECT * FROM teacher_questions WHERE level='beginner' AND day_number BETWEEN 1 AND 10");
    let count = 0;
    for (const r of res.rows) {
      await pool.query(`
        INSERT INTO teacher_questions (level, day_number, section, question, answer, submitted_by, submitted_at, updated_at, format_example)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT ON CONSTRAINT teacher_questions_level_day_number_section_key
        DO UPDATE SET question=EXCLUDED.question, answer=EXCLUDED.answer, updated_at=EXCLUDED.updated_at
      `, ['l1', r.day_number, r.section, r.question, r.answer, r.submitted_by, r.submitted_at, r.updated_at, r.format_example]);
      count++;
    }
    console.log(`Duplicated ${count} questions from beginner to l1 for days 1-10`);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
