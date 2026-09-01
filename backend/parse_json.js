import pool from './db.js';

async function check() {
  const { rows } = await pool.query("SELECT id, name, username, level, xp_total, streak, longest_streak FROM students WHERE name ILIKE '%Samriddhi%'");
  console.log('Samriddhi in Supabase:', rows);
  const { rows: days } = await pool.query("SELECT day_number, completed, xp_earned FROM day_records WHERE student_id = $1 ORDER BY day_number DESC LIMIT 5", [rows[0]?.id]);
  console.log('Recent days:', days);
  await pool.end();
}

check();
