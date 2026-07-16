import 'dotenv/config'; 
import pkg from 'pg'; 
const { Pool } = pkg; 
const pool = new Pool({ connectionString: process.env.DATABASE_URL }); 
async function check() { 
  const {rows} = await pool.query("SELECT * FROM teacher_questions WHERE level IN ('l1', 'beginner') AND day_number=2"); 
  console.log(JSON.stringify(rows, null, 2)); 
  pool.end(); 
} 
check();
