import pool from '../db.js'

/**
 * Logs an activity to the activity_logs table.
 * 
 * @param {Object} params
 * @param {'student'|'teacher'|'admin'} params.userType 
 * @param {number|null} params.userId 
 * @param {string|null} params.userLabel - Name or mobile for quick display
 * @param {string} params.action - e.g. 'login_success', 'login_fail', 'day_open', 'day_complete'
 * @param {import('express').Request} params.req - Express request object (to extract IP and user agent)
 * @param {Object} [params.metadata] - Extra context as JSON
 */
export async function logActivity({ userType, userId = null, userLabel = null, action, req, metadata = null }) {
  try {
    const ipAddress = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || null
    const userAgent = req?.headers['user-agent'] || null

    await pool.query(
      `INSERT INTO activity_logs (user_type, user_id, user_label, action, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userType, userId, userLabel, action, ipAddress, userAgent, metadata ? JSON.stringify(metadata) : null]
    )
  } catch (err) {
    console.error('[logger] Failed to log activity:', err.message)
    // We intentionally don't throw, to avoid breaking the main flow (e.g. login)
  }
}
