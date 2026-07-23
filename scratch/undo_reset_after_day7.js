import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('backend/.env') });

const db = await import('../backend/db.js');
const pool = db.default;

async function undoResets() {
  try {
    const res = await pool.query(`UPDATE day_records SET reset_at = NULL WHERE day_number > 7 AND reset_at IS NOT NULL RETURNING id`);
    console.log(`Locked ${res.rowCount} records for days > 7`);
  } catch (error) {
    console.error('Error undoing resets:', error);
  } finally {
    process.exit(0);
  }
}

undoResets();
