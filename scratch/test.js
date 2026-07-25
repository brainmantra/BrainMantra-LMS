import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('backend/.env') });

const db = await import('../backend/db.js');
const pool = db.default;

async function run() {
  const { rows } = await pool.query('SELECT * FROM day_records WHERE reset_at IS NOT NULL AND completed = false');
  console.log('Total reset days:', rows.length);
  if (rows.length > 0) {
    console.log('Sample reset day:', rows[0]);
  }
  process.exit();
}
run();
