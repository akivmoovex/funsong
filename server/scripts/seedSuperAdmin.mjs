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

  const passwordHash = bcrypt.hashSync(String(password), 12)
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
    console.log('Updated existing super admin user.')
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

  await pool.end()
  process.exit(0)
}

await main()
