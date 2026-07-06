/**
 * migrate.js — Run once to create / update all database tables.
 *   cd backend && node migrate.js
 *
 * Safe to re-run (CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS).
 * Also seeds the admin account from ADMIN_EMAIL + ADMIN_PASSWORD_PLAIN env vars.
 */
import 'dotenv/config'
import pool from './db.js'
import bcrypt from 'bcryptjs'

const SQL = `
-- ── Students ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id                 SERIAL PRIMARY KEY,
  name               TEXT        NOT NULL,
  mobile             VARCHAR(10) NOT NULL UNIQUE,
  level              VARCHAR(20) NOT NULL,
  registration_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  streak             INTEGER     NOT NULL DEFAULT 0,
  longest_streak     INTEGER     NOT NULL DEFAULT 0,
  xp_total           INTEGER     NOT NULL DEFAULT 0,
  last_streak_check  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_mobile ON students(mobile);
CREATE INDEX IF NOT EXISTS idx_students_level  ON students(level);

ALTER TABLE students ADD COLUMN IF NOT EXISTS xp_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE students ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_streak_check TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS plain_password TEXT;

-- ── Day records ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS day_records (
  id                   SERIAL PRIMARY KEY,
  student_id           INTEGER     NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  day_number           INTEGER     NOT NULL CHECK (day_number BETWEEN 1 AND 100),
  opened               BOOLEAN     NOT NULL DEFAULT FALSE,
  opened_at            TIMESTAMPTZ,
  completed            BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at         TIMESTAMPTZ,
  total_marks          INTEGER,
  accuracy             NUMERIC(5,2),
  time_taken_seconds   INTEGER,
  xp_earned            INTEGER     NOT NULL DEFAULT 0,
  question_times       JSONB,
  answers              JSONB,
  section_data         JSONB,        -- per-section completion metadata
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_day_records_student   ON day_records(student_id);
CREATE INDEX IF NOT EXISTS idx_day_records_completed ON day_records(completed, completed_at);

ALTER TABLE day_records ADD COLUMN IF NOT EXISTS total_marks    INTEGER;
ALTER TABLE day_records ADD COLUMN IF NOT EXISTS xp_earned      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE day_records ADD COLUMN IF NOT EXISTS question_times JSONB;
ALTER TABLE day_records ADD COLUMN IF NOT EXISTS answers        JSONB;
ALTER TABLE day_records ADD COLUMN IF NOT EXISTS section_data   JSONB;

-- ── Legacy questions table (kept for backward compat) ─────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id             SERIAL PRIMARY KEY,
  level          VARCHAR(20) NOT NULL,
  day_number     INTEGER     NOT NULL,
  question_text  TEXT        NOT NULL,
  question_type  VARCHAR(20) NOT NULL DEFAULT 'math',
  expected_answer TEXT       NOT NULL,
  format_example TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_level_day ON questions(level, day_number);

-- ── Admin ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Teachers ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teachers (
  id               SERIAL PRIMARY KEY,
  name             TEXT        NOT NULL,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT        NOT NULL,
  assigned_levels  TEXT[]      NOT NULL DEFAULT '{}',
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);

-- ── Teacher activity log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_activity_log (
  id          SERIAL PRIMARY KEY,
  teacher_id  INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  level       VARCHAR(20),
  day_number  INTEGER,
  section     VARCHAR(50),
  question_id INTEGER,
  old_value   TEXT,
  new_value   TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tal_teacher ON teacher_activity_log(teacher_id);
CREATE INDEX IF NOT EXISTS idx_tal_time    ON teacher_activity_log(timestamp DESC);

-- ── Question bank (seeded from Excel) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS question_bank (
  id                     SERIAL PRIMARY KEY,
  level                  VARCHAR(20) NOT NULL,
  section                VARCHAR(50) NOT NULL,
  question_index         INTEGER     NOT NULL,
  question_type          VARCHAR(20) NOT NULL,  -- 'add','mul_x','mul_div','teacher'
  addends                JSONB,
  operand1               NUMERIC,
  operator               VARCHAR(5),
  operand2               NUMERIC,
  answer                 NUMERIC,
  answer_text            TEXT,
  source_sheet           VARCHAR(30),
  source_question_number INTEGER,
  added_by               INTEGER REFERENCES teachers(id),
  is_teacher_input       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (level, section, question_index)
);

CREATE INDEX IF NOT EXISTS idx_qb_level_section ON question_bank(level, section);
CREATE INDEX IF NOT EXISTS idx_qb_teacher_input ON question_bank(is_teacher_input);

-- ── Teacher-input day questions (every-5th-day + teacher sections) ────────────
CREATE TABLE IF NOT EXISTS teacher_questions (
  id          SERIAL PRIMARY KEY,
  level       VARCHAR(20) NOT NULL,
  day_number  INTEGER     NOT NULL CHECK (day_number BETWEEN 1 AND 100),
  section     VARCHAR(50) NOT NULL DEFAULT 'teacher_day',
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  submitted_by INTEGER REFERENCES teachers(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (level, day_number, section)
);

CREATE INDEX IF NOT EXISTS idx_tq_level_day ON teacher_questions(level, day_number);

ALTER TABLE teacher_questions ADD COLUMN IF NOT EXISTS format_example TEXT;

-- ── Per-level response tables ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS responses_l1 (
  id               SERIAL PRIMARY KEY,
  student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  day_number       INTEGER NOT NULL,
  section_name     VARCHAR(50) NOT NULL,
  question_id      INTEGER REFERENCES question_bank(id),
  question_snapshot TEXT NOT NULL,
  correct_answer   TEXT NOT NULL,
  student_answer   TEXT,
  is_correct       BOOLEAN,
  time_taken_seconds NUMERIC(8,2),
  xp_earned        INTEGER NOT NULL DEFAULT 0,
  answered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS responses_l2 (LIKE responses_l1 INCLUDING ALL);
CREATE TABLE IF NOT EXISTS responses_l3 (LIKE responses_l1 INCLUDING ALL);
CREATE TABLE IF NOT EXISTS responses_l4 (LIKE responses_l1 INCLUDING ALL);
CREATE TABLE IF NOT EXISTS responses_l5 (LIKE responses_l1 INCLUDING ALL);
CREATE TABLE IF NOT EXISTS responses_l6 (LIKE responses_l1 INCLUDING ALL);
CREATE TABLE IF NOT EXISTS responses_l7 (LIKE responses_l1 INCLUDING ALL);
CREATE TABLE IF NOT EXISTS responses_l8 (LIKE responses_l1 INCLUDING ALL);
CREATE TABLE IF NOT EXISTS responses_alumni (LIKE responses_l1 INCLUDING ALL);

CREATE INDEX IF NOT EXISTS idx_resp_l1_student_day ON responses_l1(student_id, day_number);
CREATE INDEX IF NOT EXISTS idx_resp_l2_student_day ON responses_l2(student_id, day_number);
CREATE INDEX IF NOT EXISTS idx_resp_l3_student_day ON responses_l3(student_id, day_number);
CREATE INDEX IF NOT EXISTS idx_resp_l4_student_day ON responses_l4(student_id, day_number);
CREATE INDEX IF NOT EXISTS idx_resp_l5_student_day ON responses_l5(student_id, day_number);
CREATE INDEX IF NOT EXISTS idx_resp_l6_student_day ON responses_l6(student_id, day_number);
CREATE INDEX IF NOT EXISTS idx_resp_l7_student_day ON responses_l7(student_id, day_number);
CREATE INDEX IF NOT EXISTS idx_resp_l8_student_day ON responses_l8(student_id, day_number);
CREATE INDEX IF NOT EXISTS idx_resp_alumni_student_day ON responses_alumni(student_id, day_number);
`

async function migrate() {
  const client = await pool.connect()
  try {
    // Drop old level CHECK constraint if it exists (it's too restrictive)
    try {
      await client.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_level_check;`)
    } catch (e) {
      console.log('[migrate] Could not drop old level constraint:', e.message)
    }

    await client.query(SQL)
    console.log('[migrate] ✓ All tables created / verified.')

    // ── Seed admin account ────────────────────────────────────────────────────
    const adminEmail = process.env.ADMIN_EMAIL
    const adminPasswordPlain = process.env.ADMIN_PASSWORD_PLAIN

    if (adminEmail && adminPasswordPlain) {
      const hash = await bcrypt.hash(adminPasswordPlain, 12)
      await client.query(
        `INSERT INTO admin (email, password_hash)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
        [adminEmail, hash]
      )
      console.log(`[migrate] ✓ Admin account seeded for ${adminEmail}`)
    } else {
      console.log('[migrate] ⚠ ADMIN_EMAIL / ADMIN_PASSWORD_PLAIN not set — admin account not seeded.')
    }

  } catch (err) {
    console.error('[migrate] ✗ Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
