import express from 'express'
import { verifyPassword } from '../auth/password.mjs'
import { BUILT_IN_AVATAR_KEYS } from '../constants/avatarKeys.mjs'
import { findUserByEmail, findUserById } from '../db/repos/usersRepo.mjs'
import { updateUserPassword, updateUserProfile } from '../services/userProfileService.mjs'

function isValidEmail(email) {
  const s = String(email || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function normalizePhoneNumber(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  if (s.length < 7 || s.length > 24) return { error: 'invalid_phone_number' }
  if (!/^[0-9+()\-\s.]+$/.test(s)) return { error: 'invalid_phone_number' }
  return { value: s }
}

function toProfileResponse(row) {
  return {
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    phoneNumber: row.phone_number ?? '',
    email: row.email ?? '',
    avatarKey: row.avatar_key ?? ''
  }
}

/**
 * @param {{ getPool: () => import('pg').Pool | null }} d
 */
export function createAccountProfileRouter(d) {
  const r = express.Router()

  r.get('/', async (req, res) => {
    const pool = d.getPool()
    if (!pool) return res.status(503).json({ error: 'no_database' })
    const u = /** @type {{ id: string }} */ (req.funsongUser)
    const row = await findUserById(u.id, pool)
    if (!row) return res.status(404).json({ error: 'user_not_found' })
    return res.json({
      profile: toProfileResponse(row),
      avatarOptions: BUILT_IN_AVATAR_KEYS
    })
  })

  r.post('/', async (req, res) => {
    const pool = d.getPool()
    if (!pool) return res.status(503).json({ error: 'no_database' })
    const user = /** @type {{ id: string }} */ (req.funsongUser)
    const current = await findUserById(user.id, pool)
    if (!current) return res.status(404).json({ error: 'user_not_found' })

    const b = /** @type {Record<string, unknown>} */ (req.body || {})
    const email = String(b.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ error: 'email_required' })
    if (!isValidEmail(email)) return res.status(400).json({ error: 'email_invalid' })
    const existing = await findUserByEmail(email, pool)
    if (existing && String(existing.id) !== String(user.id)) {
      return res.status(409).json({ error: 'email_taken' })
    }

    const phoneNormalized = normalizePhoneNumber(b.phoneNumber)
    if (phoneNormalized && 'error' in phoneNormalized) {
      return res.status(400).json({ error: phoneNormalized.error })
    }

    const profilePayload = {
      firstName: String(b.firstName ?? '').trim(),
      lastName: String(b.lastName ?? '').trim(),
      phoneNumber: phoneNormalized?.value ?? null,
      email,
      avatarKey: String(b.avatarKey ?? '').trim() || null
    }

    try {
      await updateUserProfile(user.id, profilePayload, pool)
    } catch (e) {
      if (/** @type {any} */ (e)?.code === 'invalid_avatar_key') {
        return res.status(400).json({ error: 'invalid_avatar_key' })
      }
      throw e
    }

    const newPassword = String(b.newPassword ?? '')
    const confirmNewPassword = String(b.confirmNewPassword ?? '')
    const currentPassword = String(b.currentPassword ?? '')
    if (newPassword.trim() !== '') {
      const ok = await verifyPassword(currentPassword, current.password_hash)
      if (!ok) {
        return res.status(400).json({ error: 'current_password_invalid' })
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'password_too_short' })
      }
      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ error: 'password_mismatch' })
      }
      await updateUserPassword(user.id, newPassword, pool)
    }

    const out = await findUserById(user.id, pool)
    if (!out) return res.status(404).json({ error: 'user_not_found' })
    return res.json({
      profile: toProfileResponse(out),
      avatarOptions: BUILT_IN_AVATAR_KEYS
    })
  })

  return r
}
