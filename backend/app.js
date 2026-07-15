import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import studentsRouter    from './routes/students.js'
import leaderboardRouter from './routes/leaderboard.js'
import cronRouter        from './routes/cron.js'
import webhooksRouter    from './routes/webhooks.js'
import adminRouter       from './routes/admin.js'
import teachersRouter    from './routes/teachers.js'
import authRouter        from './routes/auth.js'

const app = express()

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map(s => s.trim())

app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/students',    studentsRouter)
app.use('/api/leaderboard', leaderboardRouter)
app.use('/api/cron',        cronRouter)
app.use('/api/webhooks',    webhooksRouter)
app.use('/api/admin',       adminRouter)
app.use('/api/teachers',    teachersRouter)
app.use('/api/auth',        authRouter)

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route not found.' })
})

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[server] Unhandled error:', err)
  res.status(500).json({ message: 'Internal server error.' })
})

app.get('/api/setup-test-users', async (req, res) => {
  try {
    const bcrypt = (await import('bcryptjs')).default;
    const pool = (await import('./db.js')).default;
    
    // Create test admin and test student
    const testHash = await bcrypt.hash('password', 10);
    await pool.query(`
      INSERT INTO admin (email, password_hash) 
      VALUES ('test@admin.com', $1) 
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, [testHash]);
    
    await pool.query(`
      INSERT INTO students (name, mobile, username, password_hash, level, registration_date) 
      VALUES ('Test Student', '0000000000', 'test', $1, 'l1', NOW()) 
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, [testHash]);

    let realAdminMsg = 'No real admin configured in env.';
    // Also try to create the real admin if env vars are set
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_PLAIN) {
       const realHash = await bcrypt.hash(process.env.ADMIN_PASSWORD_PLAIN, 10);
       await pool.query(`
         INSERT INTO admin (email, password_hash) 
         VALUES ($1, $2) 
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       `, [process.env.ADMIN_EMAIL, realHash]);
       realAdminMsg = `Real admin seeded: ${process.env.ADMIN_EMAIL}`;
    }

    res.json({ 
      message: 'Test users created successfully!', 
      admin: 'test@admin.com / password', 
      student: 'test / password',
      realAdmin: realAdminMsg
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/run-migration', async (req, res) => {
  try {
    const { migrate } = await import('./migrate.js');
    await migrate();
    res.json({ success: true, message: 'Migration completed. Real admin seeded if env vars were set.' });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ── Local dev server ──────────────────────────────────────────────────────────
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000
  app.listen(PORT, () => {
    console.log(`[server] Brain Mantra API listening on port ${PORT}`)
  })
}

export default app