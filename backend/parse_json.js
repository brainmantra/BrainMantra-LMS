import pool from './db.js';
import bcrypt from 'bcryptjs';

const passwordUpdates = [
  { username: 'tanvi_manna', password: 'BM209' },
  { username: 'soumya', password: 'BM585' },
  { username: 'aritra_bharadwaj', password: 'BM832' },
  { username: 'harshali_bajoria', password: 'BM571' },
  { username: 'shreyan_das', password: 'BM594' },
  { username: 'arman_molla', password: 'BM427' },
  { username: 'samriddhi_saha', password: 'BM147' },
  { username: 'avradeep_saha', password: 'BM414' },
  { username: 'melvin_david', password: 'BM131' },
  { username: 'aanya_shrivastava', password: 'BM674' },
  { username: 'devansh_tenany', password: 'BM774' },
  { username: 'ishaan_chattopadhyay', password: 'BM245' },
  { username: 'ujaan_chattopadhyay', password: 'BM758' },
  { username: 'yhaal_sekar_kamalkumar', password: 'BM384' },
  { username: 'arka_ghosh', password: 'BM121' },
  { username: 'ayaan_imam', password: 'BM735' },
  { username: 'shivans_joardar', password: 'BM107' },
  { username: 'aafia_imam', password: 'BM309' },
  { username: 'jyotirmoy_saha', password: 'BM643' },
  { username: 'bhavya_khemka', password: 'BM349' },
  { username: 'dishha_jain', password: 'BM565' },
  { username: 'saakshi_dabriwal', password: 'BM924' },
  { username: 'rishaan_guha_thakurta', password: 'BM482' },
  { username: 'bhavya_agarwal', password: 'BM408' },
  { username: 'vanshika_agarwal', password: 'BM609' },
  { username: 'ayaansh_manpuria', password: 'BM674' },
];

async function updatePasswords() {
  console.log(`Starting password update for ${passwordUpdates.length} students...`);
  
  for (const item of passwordUpdates) {
    const hash = await bcrypt.hash(item.password, 10);
    const res = await pool.query(
      `UPDATE students 
       SET plain_password = $1, password_hash = $2 
       WHERE LOWER(username) = LOWER($3)
       RETURNING id, name, username, plain_password`,
      [item.password, hash, item.username]
    );
    if (res.rows.length > 0) {
      const s = res.rows[0];
      console.log(`✓ Updated: [ID: ${s.id}] ${s.name} (${s.username}) -> ${s.plain_password}`);
    } else {
      console.error(`✗ NOT FOUND: ${item.username}`);
    }
  }

  console.log('\n--- VERIFYING ALL STUDENTS IN DB ---');
  const { rows: all } = await pool.query(
    "SELECT id, name, username, plain_password, (password_hash IS NOT NULL) as has_hash FROM students ORDER BY id"
  );
  for (const s of all) {
    console.log(`ID ${s.id.toString().padStart(2, ' ')} | ${s.name.padEnd(25, ' ')} | ${s.username.padEnd(25, ' ')} | Pass: ${s.plain_password}`);
  }

  await pool.end();
}

updatePasswords();
