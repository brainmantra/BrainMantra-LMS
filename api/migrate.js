/**
 * Run once to create all database tables:
 *   cd api && node migrate.js
 *
 * Safe to re-run (uses CREATE TABLE IF NOT EXISTS).
 */
import 'dotenv/config'
import pool from './db.js'

const SQL = `
-- Students table
CREATE TABLE IF NOT EXISTS students (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT        NOT NULL,
  mobile               VARCHAR(10) NOT NULL UNIQUE,
  level                VARCHAR(20) NOT NULL
                         CHECK (level IN ('beginner','elementary','intermediate','advanced','expert')),
  registration_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  streak               INTEGER     NOT NULL DEFAULT 0,
  longest_streak       INTEGER     NOT NULL DEFAULT 0,
  last_streak_check    TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_mobile ON students(mobile);

-- Day records table (one row per student per day attempted)
CREATE TABLE IF NOT EXISTS day_records (
  id                   SERIAL PRIMARY KEY,
  student_id           INTEGER     NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  day_number           INTEGER     NOT NULL CHECK (day_number BETWEEN 1 AND 100),
  opened               BOOLEAN     NOT NULL DEFAULT FALSE,
  opened_at            TIMESTAMPTZ,
  completed            BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at         TIMESTAMPTZ,
  accuracy             NUMERIC(5,2),          -- 0.00–100.00, set via Apps Script webhook
  time_taken_seconds   INTEGER,               -- set via Apps Script webhook
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_day_records_student ON day_records(student_id);
CREATE INDEX IF NOT EXISTS idx_day_records_completed ON day_records(completed, completed_at);
`

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query(SQL)
    console.log('[migrate] All tables created / verified.')
  } catch (err) {
    console.error('[migrate] Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
