import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve('backend/.env') })

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
})

async function run() {
  const { rows } = await pool.query("SELECT * FROM question_bank WHERE section_name = 'abacus' LIMIT 2");
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
run();
