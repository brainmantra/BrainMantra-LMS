import pool from './db.js';
import bcrypt from 'bcryptjs';

async function checkStudentPasswords() {
  const { rows: students } = await pool.query(
    "SELECT id, name, username, mobile, plain_password, password_hash, (password_hash IS NOT NULL) AS has_hash FROM students ORDER BY id"
  );
  console.log(`Total students: ${students.length}`);
  let issues = 0;
  for (const s of students) {
    let hashMatches = false;
    if (s.password_hash && s.plain_password) {
      hashMatches = await bcrypt.compare(s.plain_password, s.password_hash);
    }
    console.log(`ID: ${s.id} | Name: ${s.name} | User: ${s.username} | Mob: ${s.mobile} | Pass: ${s.plain_password} | Hash Valid: ${hashMatches}`);
    if (!s.password_hash || !hashMatches) {
      issues++;
    }
  }
  console.log(`\nFound ${issues} students with missing/invalid password hashes.`);
  await pool.end();
}

checkStudentPasswords();
