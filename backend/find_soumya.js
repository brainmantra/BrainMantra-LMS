import 'dotenv/config';
import pool from './db.js';

async function findSoumya() {
  try {
    const res = await pool.query("SELECT * FROM students WHERE name ILIKE '%Soumya%'");
    console.log(res.rows);
  } finally {
    await pool.end();
  }
}
findSoumya();
