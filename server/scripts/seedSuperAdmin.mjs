import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { getPool } from '../src/db/pool.mjs'
import { createUser, findUserByEmail } from '../src/db/repos/usersRepo.mjs'

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL || '').trim()
  const password = process.env.SUPER_ADMIN_PASSWORD
  const name = (process.env.SUPER_ADMIN_NAME || '').trim()

  if (!email || !password || !name) {
    console.error(
      'Set SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, and SUPER_ADMIN_NAME in the environment (see .env.example).'
    )
    process.exit(1)
  }

  const pool = getPool()
  if (!pool) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }

  console.log('[funsong] Super admin seed: starting')
  const passwordHash = bcrypt.hashSync(String(password), 12)
  try {
    const existing = await findUserByEmail(email, pool)

    if (existing) {
      await pool.query(
        `UPDATE users
         SET password_hash = $1,
             display_name = btrim($2::text),
             role = 'super_admin'::user_role
         WHERE id = $3::uuid`,
        [passwordHash, name, existing.id]
      )
      console.log('Updated existing super admin user (password was rotated).')
    } else {
      await createUser(
        {
          email,
          passwordHash,
          displayName: name,
          role: 'super_admin'
        },
        pool
      )
      console.log('Created super admin user.')
    }
  } catch (e) {
    const err = /** @type {{ code?: string; message?: string }} */ (e)
    const m = (err.message || String(e) || '').toLowerCase()
    if (err.code === '42P01' || m.includes('relation "users"') && m.includes('does not exist')) {
      console.error('Users table not found. Run npm run db:migrate first.')
    } else {
      const safe = e instanceof Error ? e.message : String(e)
      console.error('Super admin seed failed:', safe)
    }
    await pool.end()
    process.exit(1)
  }

  console.log('[funsong] Super admin seed: completed successfully')
  await pool.end()
  process.exit(0)
}

await main()
