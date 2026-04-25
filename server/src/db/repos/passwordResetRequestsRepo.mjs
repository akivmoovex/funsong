import { getDbPool } from './poolContext.mjs'

/**
 * @param {{ email: string; userId?: string | null; status?: string }} o
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function createPasswordResetRequest(o, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `INSERT INTO password_reset_requests (email, user_id, status)
     VALUES (lower(btrim($1::text)), $2::uuid, COALESCE($3::text, 'pending'))
     RETURNING *`,
    [o.email, o.userId ?? null, o.status ?? 'pending']
  )
  return rows[0] || null
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function listPendingPasswordResetRequests(p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT prr.*,
            u.email AS user_email,
            u.display_name AS user_display_name
       FROM password_reset_requests prr
       LEFT JOIN users u ON u.id = prr.user_id
      WHERE prr.status = 'pending'
      ORDER BY prr.requested_at DESC
      LIMIT 200`
  )
  return rows
}
