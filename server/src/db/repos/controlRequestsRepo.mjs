import { getDbPool } from './poolContext.mjs'

export async function findById(id, p) {
  const q = getDbPool(p)
  const { rows } = await q.query('SELECT * FROM control_requests WHERE id = $1::uuid', [id])
  return rows[0] || null
}

export async function listBySessionId(sessionId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    'SELECT * FROM control_requests WHERE session_id = $1::uuid ORDER BY created_at DESC, id',
    [sessionId]
  )
  return rows
}

/**
 * @param {{ sessionId: string; partyGuestId: string; songId?: string | null }} o
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function createRequest(o, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `INSERT INTO control_requests (session_id, party_guest_id, status, song_id)
     VALUES ($1::uuid, $2::uuid, 'pending', $3)
     RETURNING *`,
    [o.sessionId, o.partyGuestId, o.songId ?? null]
  )
  return rows[0]
}

/**
 * Pending control requests for a session (oldest first).
 * @param {string} sessionId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function listPendingBySessionId(sessionId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT
       cr.id,
       cr.session_id,
       cr.party_guest_id,
       cr.song_id,
       cr.status,
       cr.created_at,
       g.display_name AS guest_display_name
     FROM control_requests cr
     INNER JOIN party_guests g ON g.id = cr.party_guest_id
     WHERE cr.session_id = $1::uuid AND cr.status = 'pending'
     ORDER BY cr.created_at ASC, cr.id`,
    [sessionId]
  )
  return rows
}

/**
 * @param {string} id
 * @param {string} approvedByUserId
 * @param {import('pg').Pool|import('pg').PoolClient} c
 */
export async function approveRequestById(id, approvedByUserId, c) {
  const { rows } = await c.query(
    `UPDATE control_requests
     SET
       status = 'approved'::control_request_status,
       approved_by_user_id = $2::uuid,
       approved_at = now(),
       updated_at = now()
     WHERE id = $1::uuid AND status = 'pending'::control_request_status
     RETURNING *`,
    [id, approvedByUserId]
  )
  return rows[0] || null
}

/**
 * @param {string} sessionId
 * @param {string} exceptRequestId
 * @param {import('pg').Pool|import('pg').PoolClient} c
 */
export async function rejectOtherPendingForSession(sessionId, exceptRequestId, c) {
  await c.query(
    `UPDATE control_requests
     SET status = 'rejected'::control_request_status, updated_at = now()
     WHERE session_id = $1::uuid AND status = 'pending'::control_request_status
       AND id <> $2::uuid`,
    [sessionId, exceptRequestId]
  )
}

/**
 * @param {string} id
 * @param {import('pg').Pool|import('pg').PoolClient} c
 */
export async function rejectRequestById(id, c) {
  const { rows } = await c.query(
    `UPDATE control_requests
     SET status = 'rejected'::control_request_status, updated_at = now()
     WHERE id = $1::uuid AND status = 'pending'::control_request_status
     RETURNING *`,
    [id]
  )
  return rows[0] || null
}

/**
 * @param {string} sessionId
 * @param {import('pg').Pool|import('pg').PoolClient} c
 */
export async function rejectAllPendingForSession(sessionId, c) {
  await c.query(
    `UPDATE control_requests
     SET status = 'rejected'::control_request_status, updated_at = now()
     WHERE session_id = $1::uuid AND status = 'pending'::control_request_status`,
    [sessionId]
  )
}

/**
 * @param {string} sessionId
 * @param {string} partyGuestId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function hasPendingControlForGuest(sessionId, partyGuestId, p) {
  const q = getDbPool(p)
  const { rowCount } = await q.query(
    `SELECT 1 FROM control_requests
     WHERE session_id = $1::uuid AND party_guest_id = $2::uuid AND status = 'pending'`,
    [sessionId, partyGuestId]
  )
  return (rowCount ?? 0) > 0
}
