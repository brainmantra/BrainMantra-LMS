import pool from './db.js';
import fs from 'fs';

async function importTeacherQuestions() {
  const raw = fs.readFileSync('output.json', 'utf16le').replace(/^\uFEFF/, '').trim();
  const data = JSON.parse(raw);
  for (const item of data) {
    const q = 'INSERT INTO teacher_questions (level, day_number, section, question, answer, format_example, submitted_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (level, day_number, section) DO UPDATE SET question = EXCLUDED.question, answer = EXCLUDED.answer';
    await pool.query(q, [item.level, item.day_number, item.section, item.question, item.answer, item.format_example, item.submitted_at, item.updated_at]);
  }
  console.log(`Seeded ${data.length} teacher questions into Aiven successfully!`);
  await pool.end();
}

importTeacherQuestions();
