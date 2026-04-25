import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from '../src/db/pool.mjs'
import { findUserByEmail } from '../src/db/repos/usersRepo.mjs'
import { hashPassword } from '../src/auth/password.mjs'

async function hasUsersUpdatedAtColumn(pool) {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'updated_at'
     ) AS exists`
  )
  return rows[0]?.exists === true
}

export async function resetSuperAdminPassword({ pool, email, password }) {
  const user = await findUserByEmail(email, pool)
  if (!user) {
    return { ok: false, reason: 'not_found' }
  }
  if (user.role !== 'super_admin') {
    return { ok: false, reason: 'not_super_admin' }
  }

  const passwordHash = hashPassword(password)
  const withUpdatedAt = await hasUsersUpdatedAtColumn(pool)

  if (withUpdatedAt) {
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           is_active = true,
           updated_at = now()
       WHERE id = $2::uuid`,
      [passwordHash, user.id]
    )
  } else {
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           is_active = true
       WHERE id = $2::uuid`,
      [passwordHash, user.id]
    )
  }

  return { ok: true }
}

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL || '').trim()
  const password = process.env.SUPER_ADMIN_PASSWORD

  if (!email || !password) {
    console.error('Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in the environment (see .env.example).')
    process.exit(1)
  }

  const pool = getPool()
  if (!pool) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }

  console.log('[funsong] Super admin password reset: starting')
  try {
    const result = await resetSuperAdminPassword({
      pool,
      email,
      password: String(password)
    })

    if (!result.ok && result.reason === 'not_found') {
      console.error('Super admin user not found. Run npm run db:seed first.')
      process.exit(1)
    }
    if (!result.ok && result.reason === 'not_super_admin') {
      console.error('User exists but is not super_admin. Refusing password reset.')
      process.exit(1)
    }

    console.log('[funsong] Super admin password reset: completed successfully')
    process.exit(0)
  } catch (e) {
    const safe = e instanceof Error ? e.message : String(e)
    console.error('Super admin password reset failed:', safe)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

const isDirectRun = (() => {
  const scriptPath = fileURLToPath(import.meta.url)
  const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
  return scriptPath === invokedPath
})()

if (isDirectRun) {
  await main()
}
