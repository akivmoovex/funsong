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

/**
 * @param {string} userId
 * @param {{
 *  firstName?: string | null
 *  lastName?: string | null
 *  phoneNumber?: string | null
 *  email?: string | null
 *  avatarKey?: string | null
 * }} o
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function updateUserProfile(userId, o, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `UPDATE users
       SET first_name = CASE WHEN $2::boolean THEN NULLIF(btrim($3::text), '') ELSE first_name END,
           last_name = CASE WHEN $4::boolean THEN NULLIF(btrim($5::text), '') ELSE last_name END,
           phone_number = CASE WHEN $6::boolean THEN NULLIF(btrim($7::text), '') ELSE phone_number END,
           email = CASE WHEN $8::boolean THEN lower(btrim($9::text)) ELSE email END,
           avatar_key = CASE WHEN $10::boolean THEN NULLIF(btrim($11::text), '') ELSE avatar_key END,
           updated_at = now()
     WHERE id = $1::uuid
     RETURNING *`,
    [
      userId,
      Object.prototype.hasOwnProperty.call(o, 'firstName'),
      o.firstName ?? null,
      Object.prototype.hasOwnProperty.call(o, 'lastName'),
      o.lastName ?? null,
      Object.prototype.hasOwnProperty.call(o, 'phoneNumber'),
      o.phoneNumber ?? null,
      Object.prototype.hasOwnProperty.call(o, 'email'),
      o.email ?? null,
      Object.prototype.hasOwnProperty.call(o, 'avatarKey'),
      o.avatarKey ?? null
    ]
  )
  return rows[0] || null
}

/**
 * @param {string} userId
 * @param {string} passwordHash
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function updateUserPassword(userId, passwordHash, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `UPDATE users
       SET password_hash = $2::text,
           updated_at = now()
     WHERE id = $1::uuid
     RETURNING *`,
    [userId, String(passwordHash)]
  )
  return rows[0] || null
}
