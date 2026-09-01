import pool from './db.js';

async function syncBeadFunAndActivity() {
  const { rows } = await pool.query("SELECT * FROM teacher_questions WHERE level IN ('beginner', 'l1') AND section IN ('bead_fun', 'activity')");
  console.log(`Found ${rows.length} existing questions to sync.`);
  for (const r of rows) {
    const otherLevel = r.level === 'beginner' ? 'l1' : 'beginner';
    await pool.query(
      `INSERT INTO teacher_questions (level, day_number, section, question, answer, format_example, submitted_by, submitted_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (level, day_number, section)
       DO UPDATE SET question = EXCLUDED.question, answer = EXCLUDED.answer, format_example = EXCLUDED.format_example, updated_at = NOW()`,
      [otherLevel, r.day_number, r.section, r.question, r.answer, r.format_example, r.submitted_by, r.submitted_at, r.updated_at]
    );
  }
  console.log('✓ Successfully synchronized bead_fun and activity questions between Level 1 and Beginner!');
  await pool.end();
}

syncBeadFunAndActivity();
