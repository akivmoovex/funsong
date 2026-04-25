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
 * @param {{ sessionId: string; partyGuestId: string; songId?: string | null; requestKind?: 'control' | 'song' }} o
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function createRequest(o, p) {
  const q = getDbPool(p)
  const requestKind = o.requestKind === 'song' ? 'song' : 'control'
  const { rows } = await q.query(
    `INSERT INTO control_requests (session_id, party_guest_id, status, song_id, request_kind)
     VALUES ($1::uuid, $2::uuid, 'pending', $3, $4::text)
     RETURNING *`,
    [o.sessionId, o.partyGuestId, o.songId ?? null, requestKind]
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
       g.display_name AS guest_display_name,
       s.title AS song_title,
       ppi.id AS playlist_item_id
     FROM control_requests cr
     INNER JOIN party_guests g ON g.id = cr.party_guest_id
     LEFT JOIN songs s ON s.id = cr.song_id
     LEFT JOIN LATERAL (
       SELECT p.id
       FROM party_playlist_items p
       WHERE p.session_id = cr.session_id
         AND p.song_id = cr.song_id
         AND p.item_status IN ('active'::party_playlist_item_status, 'pending'::party_playlist_item_status)
       ORDER BY
         CASE WHEN p.item_status = 'active'::party_playlist_item_status THEN 0 ELSE 1 END,
         p.position ASC,
         p.created_at ASC,
         p.id ASC
       LIMIT 1
     ) ppi ON true
     WHERE cr.session_id = $1::uuid
       AND cr.status = 'pending'
       AND cr.request_kind = 'control'
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
     WHERE id = $1::uuid
       AND status = 'pending'::control_request_status
       AND request_kind = 'control'
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
     WHERE session_id = $1::uuid
       AND status = 'pending'::control_request_status
       AND request_kind = 'control'
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
     WHERE id = $1::uuid
       AND status = 'pending'::control_request_status
       AND request_kind = 'control'
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
     WHERE session_id = $1::uuid
       AND status = 'pending'::control_request_status
       AND request_kind = 'control'`,
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
     WHERE session_id = $1::uuid
       AND party_guest_id = $2::uuid
       AND status = 'pending'
       AND request_kind = 'control'`,
    [sessionId, partyGuestId]
  )
  return (rowCount ?? 0) > 0
}

/**
 * @param {string} sessionId
 * @param {string} songId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function hasPendingSongRequestForSessionSong(sessionId, songId, p) {
  const q = getDbPool(p)
  const { rowCount } = await q.query(
    `SELECT 1 FROM control_requests
     WHERE session_id = $1::uuid
       AND song_id = $2::uuid
       AND status = 'pending'::control_request_status
       AND request_kind = 'song'`,
    [sessionId, songId]
  )
  return (rowCount ?? 0) > 0
}

/**
 * @param {string} sessionId
 * @param {string} songId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function hasApprovedSongRequestForSessionSong(sessionId, songId, p) {
  const q = getDbPool(p)
  const { rowCount } = await q.query(
    `SELECT 1 FROM control_requests
     WHERE session_id = $1::uuid
       AND song_id = $2::uuid
       AND status = 'approved'::control_request_status
       AND request_kind = 'song'`,
    [sessionId, songId]
  )
  return (rowCount ?? 0) > 0
}

/**
 * @param {string} sessionId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function listPendingSongRequestsBySessionId(sessionId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT
       cr.id,
       cr.session_id,
       cr.party_guest_id,
       cr.song_id,
       cr.status,
       cr.created_at,
       g.display_name AS guest_display_name,
       s.title AS song_title
     FROM control_requests cr
     INNER JOIN party_guests g ON g.id = cr.party_guest_id
     INNER JOIN songs s ON s.id = cr.song_id
     WHERE cr.session_id = $1::uuid
       AND cr.status = 'pending'::control_request_status
       AND cr.request_kind = 'song'
       AND cr.song_id IS NOT NULL
     ORDER BY cr.created_at ASC, cr.id`,
    [sessionId]
  )
  return rows
}

/**
 * @param {string} requestId
 * @param {string} approvedByUserId
 * @param {import('pg').Pool|import('pg').PoolClient} c
 */
export async function approveSongRequestById(requestId, approvedByUserId, c) {
  const { rows } = await c.query(
    `UPDATE control_requests
     SET
       status = 'approved'::control_request_status,
       approved_by_user_id = $2::uuid,
       approved_at = now(),
       updated_at = now()
     WHERE id = $1::uuid
       AND status = 'pending'::control_request_status
       AND request_kind = 'song'
       AND song_id IS NOT NULL
     RETURNING *`,
    [requestId, approvedByUserId]
  )
  return rows[0] || null
}

/**
 * @param {string} requestId
 * @param {import('pg').Pool|import('pg').PoolClient} c
 */
export async function rejectSongRequestById(requestId, c) {
  const { rows } = await c.query(
    `UPDATE control_requests
     SET status = 'rejected'::control_request_status, updated_at = now()
     WHERE id = $1::uuid
       AND status = 'pending'::control_request_status
       AND request_kind = 'song'
       AND song_id IS NOT NULL
     RETURNING *`,
    [requestId]
  )
  return rows[0] || null
}
