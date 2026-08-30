import 'dotenv/config';
import pool from './db.js';

async function fetchL7() {
  try {
    const res = await pool.query("SELECT id, name, username, level FROM students WHERE level = 'l7'");
    console.log(res.rows);
  } finally {
    await pool.end();
  }
}
fetchL7();
