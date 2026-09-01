import pg from 'pg';
const { Pool } = pg;


if (!process.env.NEON_URL) {
  process.env.NEON_URL = 'postgresql://neondb_owner:npg_z49sXVqJYwrA@ep-rapid-bird-ao53qua0-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
}
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'postgresql://postgres.adfgdwarqgxyxrlrixdo:Ny4YC%2B8%24xA%23dm3.@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';
}

const sourcePool = new Pool({ connectionString: process.env.NEON_URL, ssl: { rejectUnauthorized: false } });
const targetPool = new Pool({ connectionString: process.env.SUPABASE_URL, ssl: { rejectUnauthorized: false } });

async function copyTable(tableName, idCol = 'id') {
  console.log(`[Copy] Migrating table ${tableName}...`);
  try {
    const { rows } = await sourcePool.query(`SELECT * FROM ${tableName}`);
    console.log(`[Copy] Found ${rows.length} rows in ${tableName} on Neon.`);
    if (rows.length === 0) return;

    const cols = Object.keys(rows[0]);
    const colList = cols.map(c => `\"${c}\"`).join(', ');

    for (const row of rows) {
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const values = cols.map(c => row[c]);
      const updateSet = cols.filter(c => c !== idCol).map(c => `\"${c}\" = EXCLUDED.\"${c}\"`).join(', ');

      const query = updateSet
        ? `INSERT INTO ${tableName} (${colList}) VALUES (${placeholders}) ON CONFLICT ("${idCol}") DO UPDATE SET ${updateSet}`
        : `INSERT INTO ${tableName} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

      await targetPool.query(query, values);
    }
    console.log(`[Copy] ✄ Successfully copied ${rows.length} rows to Supabase!`);
  } catch (err) {
    console.error(`[Copy] Error migrating ${tableName}:`, err.message);
  }
}

async function run() {
  console.log('Starting migration from Neon to Supabase...');
  const tables = [
    'admin_users',
    'teachers',
    'students',
    'teacher_questions',
    'question_bank',
    'day_records',
    'responses_l1',
    'responses_l2',
    'responses_l3',
    'responses_l4',
    'responses_l5',
    'responses_l6',
    'responses_l7',
    'responses_l8',
    'responses_beginner',
    'responses_gm',
    'responses_alumni'
  ];

  for (const t of tables) {
    await copyTable(t);
  }

  try {
    await targetPool.query(`SELECT setval('students_id_seq', COALESCE((SELECT MAX(id)+1 FROM students), 1), false)`);
    await targetPool.query(`SELECT setval('teachers_id_seq', COALESCE((SELECT MAX(id)+1 FROM teachers), 1), false)`);
    await targetPool.query(`SELECT setval('day_records_id_seq', COALESCE((SELECT MAX(id)+1 FROM day_records), 1), false)`);
  } catch (seqErr) {
    console.log('Sequence update note:', seqErr.message);
  }

  console.log('Migration to Supabase Complete!');
  await sourcePool.end();
  await targetPool.end();
}

run();
