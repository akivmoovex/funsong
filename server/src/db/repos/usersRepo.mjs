import { getDbPool } from './poolContext.mjs'

const SELECT_BASE = 'SELECT * FROM users'

export async function findUserById(id, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(`${SELECT_BASE} WHERE id = $1::uuid`, [id])
  return rows[0] || null
}

export async function findUserByEmail(email, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `${SELECT_BASE} WHERE lower(btrim(email::text)) = lower(btrim($1::text))`,
    [String(email || '')]
  )
  return rows[0] || null
}

export async function createUser(o, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `INSERT INTO users (email, password_hash, display_name, role)
     VALUES (lower(btrim($1::text)), $2, btrim($3::text), $4::user_role)
     RETURNING *`,
    [o.email, o.passwordHash ?? null, o.displayName, o.role]
  )
  return rows[0]
}
