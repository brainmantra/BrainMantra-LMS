import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

// NOTE: Do NOT call process.exit() here — this module is imported at build time
// by Vercel and env vars are only available at runtime.
let pool = null

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost')
      ? false
      : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })

  pool.on('error', (err) => {
    console.error('[db] Unexpected pool error:', err)
  })
} else {
  console.warn('[db] DATABASE_URL is not set. DB calls will fail at runtime.')
}

export default pool
