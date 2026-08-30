import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

// NOTE: Do NOT call process.exit() here — this module is imported at build time
// by Vercel and env vars are only available at runtime.
let pool = null

if (process.env.DATABASE_URL) {
  let connectionString = process.env.DATABASE_URL
  const isLocal = connectionString.includes('localhost')

  if (!isLocal) {
    // Strip sslmode param so custom SSL options take precedence
    connectionString = connectionString.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
  }

  pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
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
