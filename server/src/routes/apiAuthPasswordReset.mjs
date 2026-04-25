import express from 'express'
import { findUserByEmail } from '../db/repos/usersRepo.mjs'
import {
  createPasswordResetRequest,
  listPendingPasswordResetRequests
} from '../db/repos/passwordResetRequestsRepo.mjs'

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))
}

/**
 * @param {{ getPool: () => import('pg').Pool | null }} d
 */
export function createAuthPasswordResetRouter(d) {
  const r = express.Router()

  r.post('/', async (req, res) => {
    const pool = d.getPool()
    if (!pool) return res.status(503).json({ error: 'no_database' })
    const b = /** @type {{ email?: string }} */ (req.body || {})
    const email = normalizeEmail(b.email)
    if (isValidEmail(email)) {
      const user = await findUserByEmail(email, pool)
      await createPasswordResetRequest(
        {
          email,
          userId: user?.id || null,
          status: 'pending'
        },
        pool
      )
    }
    return res.json({
      ok: true,
      message: 'If this account exists, password reset instructions will be provided.'
    })
  })

  return r
}

/**
 * @param {{ getPool: () => import('pg').Pool | null }} d
 */
export function createAdminPasswordResetRequestsRouter(d) {
  const r = express.Router()
  r.get('/', async (req, res) => {
    const pool = d.getPool()
    if (!pool) return res.status(503).json({ error: 'no_database' })
    const rows = await listPendingPasswordResetRequests(pool)
    return res.json({
      requests: rows.map((r) => ({
        id: String(r.id),
        email: String(r.email),
        userId: r.user_id ? String(r.user_id) : null,
        userEmail: r.user_email ? String(r.user_email) : null,
        userDisplayName: r.user_display_name ? String(r.user_display_name) : null,
        status: String(r.status),
        requestedAt: r.requested_at
      }))
    })
  })
  return r
}
