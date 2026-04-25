import { getDbPool } from './poolContext.mjs'
import { rejectAllPendingForSession } from './controlRequestsRepo.mjs'

export async function findSessionById(id, p) {
  const q = getDbPool(p)
  const { rows } = await q.query('SELECT * FROM party_sessions WHERE id = $1::uuid', [id])
  return rows[0] || null
}

export async function findSessionByPartyRequestId(partyRequestId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    'SELECT * FROM party_sessions WHERE party_request_id = $1::uuid',
    [partyRequestId]
  )
  return rows[0] || null
}

/**
 * @param {string} partyCode
 * @param {import('pg').Pool} p
 */
export async function findSessionByPartyCode(partyCode, p) {
  const q = getDbPool(p)
  const { rows } = await q.query('SELECT * FROM party_sessions WHERE party_code = $1::text', [
    partyCode
  ])
  return rows[0] || null
}

const SESSION_ADMIN_LIST_SELECT = `
  SELECT
    s.*,
    pr.party_name AS request_party_name,
    pr.status AS request_status,
    u.email AS host_email,
    u.display_name AS host_display_name,
    sg.title AS active_song_title,
    (SELECT count(*)::int
     FROM party_guests g
     WHERE g.session_id = s.id AND g.is_connected = true) AS connected_guests,
    cg.id AS controller_guest_id,
    cg.display_name AS controller_display_name
  FROM party_sessions s
  JOIN party_requests pr ON pr.id = s.party_request_id
  JOIN users u ON u.id = s.host_id
  LEFT JOIN songs sg ON sg.id = s.active_song_id
  LEFT JOIN party_guests cg ON cg.id = s.current_controller_party_guest_id
`

/**
 * Admin monitor: approved request + session still live (`approved` or `active` only).
 * @param {import('pg').Pool} p
 */
export async function listSessionsForAdmin(p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `${SESSION_ADMIN_LIST_SELECT}
   WHERE pr.status = 'approved'
     AND s.status IN (
       'approved'::party_session_status,
       'active'::party_session_status,
       'ended'::party_session_status,
       'disabled'::party_session_status
     )
   ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC`
  )
  return rows
}

/**
 * @param {string} sessionId
 * @param {import('pg').Pool} p
 * @returns {Promise<import('pg').QueryResultRow | null>}
 */
export async function findSessionRowForAdminById(sessionId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `${SESSION_ADMIN_LIST_SELECT}
   WHERE s.id = $1::uuid`,
    [sessionId]
  )
  return rows[0] || null
}

/**
 * @param {string} sessionId
 * @param {import('pg').Pool} p
 */
export async function disableSessionById(sessionId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `UPDATE party_sessions
     SET status = 'disabled', updated_at = now()
     WHERE id = $1::uuid
     RETURNING *`,
    [sessionId]
  )
  return rows[0] || null
}

/**
 * @param {string} sessionId
 * @param {string | null} partyGuestId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function setCurrentControllerGuest(sessionId, partyGuestId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `UPDATE party_sessions
     SET current_controller_party_guest_id = $2::uuid,
         updated_at = now()
     WHERE id = $1::uuid
     RETURNING *`,
    [sessionId, partyGuestId]
  )
  return rows[0] || null
}

/**
 * @param {string} sessionId
 * @param {number} lineNumber
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function updateSessionCurrentLine(sessionId, lineNumber, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `UPDATE party_sessions
     SET current_line_number = $2::int,
         updated_at = now()
     WHERE id = $1::uuid
           AND active_song_id IS NOT NULL
     RETURNING *`,
    [sessionId, lineNumber]
  )
  return rows[0] || null
}

/**
 * @param {string} sessionId
 * @param {boolean} enabled
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function setControllerAudioEnabled(sessionId, enabled, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `UPDATE party_sessions
     SET controller_audio_enabled = $2::bool,
         updated_at = now()
     WHERE id = $1::uuid
     RETURNING *`,
    [sessionId, enabled]
  )
  return rows[0] || null
}

/**
 * Host ends the party: status `ended`, clears playback/controller, sets `ended_at`.
 * @param {string} partyRequestId
 * @param {string} hostUserId
 * @param {import('pg').Pool} pool
 * @returns {Promise<
 *   | { ok: true; session: import('pg').QueryResultRow }
 *   | { ok: false; error: 'not_found' | 'no_session' | 'already_closed' | 'invalid_state' }
 * >}
 */
export async function endPartySessionForHost(partyRequestId, hostUserId, pool) {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const { rows: prRows } = await c.query(
      `SELECT * FROM party_requests WHERE id = $1::uuid AND host_id = $2::uuid FOR UPDATE`,
      [partyRequestId, hostUserId]
    )
    const pr = prRows[0]
    if (!pr || pr.status !== 'approved') {
      await c.query('ROLLBACK')
      return { ok: false, error: 'not_found' }
    }
    const { rows: sRows } = await c.query(
      `SELECT * FROM party_sessions WHERE party_request_id = $1::uuid FOR UPDATE`,
      [partyRequestId]
    )
    const session = sRows[0]
    if (!session) {
      await c.query('ROLLBACK')
      return { ok: false, error: 'no_session' }
    }
    if (String(/** @type {any} */ (session).host_id) !== String(hostUserId)) {
      await c.query('ROLLBACK')
      return { ok: false, error: 'not_found' }
    }
    const st = String(/** @type {any} */ (session).status)
    if (st === 'ended' || st === 'disabled') {
      await c.query('ROLLBACK')
      return { ok: false, error: 'already_closed' }
    }
    if (st !== 'approved' && st !== 'active') {
      await c.query('ROLLBACK')
      return { ok: false, error: 'invalid_state' }
    }
    const sid = String(/** @type {any} */ (session).id)
    const { rows: upd } = await c.query(
      `UPDATE party_sessions
       SET status = 'ended'::party_session_status,
           ended_at = now(),
           playback_status = 'idle'::playback_status,
           active_song_id = NULL,
           active_playlist_item_id = NULL,
           current_line_number = NULL,
           current_controller_party_guest_id = NULL,
           controller_audio_enabled = FALSE,
           updated_at = now()
       WHERE id = $1::uuid
       RETURNING *`,
      [sid]
    )
    const row = upd[0]
    if (!row) {
      await c.query('ROLLBACK')
      return { ok: false, error: 'invalid_state' }
    }
    await rejectAllPendingForSession(sid, c)
    await c.query('COMMIT')
    return { ok: true, session: row }
  } catch (e) {
    try {
      await c.query('ROLLBACK')
    } catch {
      // ignore
    }
    throw e
  } finally {
    c.release()
  }
}

export async function createSession(o, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `INSERT INTO party_sessions (
        party_request_id, host_id, title, join_code, max_guests, status, playback_status
     ) VALUES (
        $1::uuid, $2::uuid, $3, $4, COALESCE($5, 30), 'approved', 'idle'
     )
     RETURNING *`,
    [o.partyRequestId, o.hostId, o.title ?? null, o.joinCode ?? null, o.maxGuests ?? 30]
  )
  return rows[0]
}
