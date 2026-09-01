import pool from './db.js';

async function listStudents() {
  const { rows } = await pool.query(
    "SELECT id, name, username, mobile, level, plain_password FROM students ORDER BY id"
  );
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}

listStudents();
