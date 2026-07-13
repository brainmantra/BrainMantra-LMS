import { Router } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../db.js'
import { signAdminToken, signTeacherToken } from '../middleware/auth.js'
import { logActivity } from '../utils/logger.js'

const router = Router()

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Unified login endpoint checking admin, teacher, and student credentials.
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body
    if (!loginId || !password) {
      return res.status(400).json({ message: 'Login ID and password required.' })
    }

    const identifier = String(loginId).trim().toLowerCase()

    // 1. Check Admin Table
    const { rows: adminRows } = await pool.query('SELECT * FROM admin WHERE LOWER(TRIM(email)) = $1', [identifier])
    const admin = adminRows[0]
    if (admin) {
      const valid = await bcrypt.compare(password, admin.password_hash)
      if (valid) {
        const token = signAdminToken(admin)
        await logActivity({ userType: 'admin', userId: admin.id, userLabel: identifier, action: 'login_success', req })
        return res.json({
          role: 'admin',
          token,
          redirectUrl: '/admin/dashboard',
          user: { id: admin.id, email: admin.email }
        })
      } else {
        await logActivity({ userType: 'admin', userLabel: identifier, action: 'login_fail', req, metadata: { reason: 'wrong_password' } })
      }
    }

    // 2. Check Teacher Table
    const { rows: teacherRows } = await pool.query('SELECT * FROM teachers WHERE LOWER(TRIM(email)) = $1 AND is_active = TRUE', [identifier])
    const teacher = teacherRows[0]
    if (teacher) {
      const valid = await bcrypt.compare(password, teacher.password_hash)
      if (valid) {
        const token = signTeacherToken(teacher)
        await logActivity({ userType: 'teacher', userId: teacher.id, userLabel: identifier, action: 'login_success', req })
        return res.json({
          role: 'teacher',
          token,
          redirectUrl: '/teacher/dashboard',
          user: {
            id: teacher.id,
            name: teacher.name,
            email: teacher.email,
            assigned_levels: teacher.assigned_levels
          }
        })
      } else {
        await logActivity({ userType: 'teacher', userLabel: identifier, action: 'login_fail', req, metadata: { reason: 'wrong_password' } })
      }
    }

    // 3. Check Student Table
    const { rows: studentRows } = await pool.query('SELECT * FROM students WHERE LOWER(username) = $1 OR mobile = $2', [identifier, identifier])
    const student = studentRows[0]
    if (student) {
      if (!student.password_hash) {
        return res.status(401).json({ message: 'Account not set up properly. Please contact your teacher.' })
      }
      const valid = await bcrypt.compare(password, student.password_hash)
      if (valid) {
        // Set first_login_date on first ever login (starts the 100-day challenge clock)
        if (!student.first_login_date) {
          await pool.query('UPDATE students SET first_login_date = NOW() WHERE id = $1', [student.id])
          student.first_login_date = new Date().toISOString()
        }

        await logActivity({ userType: 'student', userId: student.id, userLabel: student.name, action: 'login_success', req })
        return res.json({
          role: 'student',
          redirectUrl: '/welcome',
          user: {
            id: student.id,
            name: student.name,
            mobile: student.mobile,
            level: student.level,
            username: student.username,
            plain_password: student.plain_password,
            first_login_date: student.first_login_date,
            registration_date: student.registration_date
          }
        })
      } else {
        await logActivity({ userType: 'student', userId: student.id, userLabel: student.name, action: 'login_fail', req, metadata: { reason: 'wrong_password' } })
      }
    }

    // 4. Default Fail response
    return res.status(401).json({ message: 'Invalid credentials.' })

  } catch (err) {
    console.error('[auth/login]', err)
    return res.status(500).json({ message: 'Server error during login.' })
  }
})

export default router
