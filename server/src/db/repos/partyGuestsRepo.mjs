import { getDbPool } from './poolContext.mjs'

export async function findGuestById(id, p) {
  const q = getDbPool(p)
  const { rows } = await q.query('SELECT * FROM party_guests WHERE id = $1::uuid', [id])
  return rows[0] || null
}

export async function listGuestsBySessionId(sessionId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    'SELECT * FROM party_guests WHERE session_id = $1::uuid ORDER BY created_at, id',
    [sessionId]
  )
  return rows
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} p
 */
export async function countConnectedGuestsBySessionId(sessionId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT count(*)::int AS c
     FROM party_guests
     WHERE session_id = $1::uuid AND is_connected = true`,
    [sessionId]
  )
  return Number(rows[0]?.c || 0)
}

/**
 * @param {string} token
 * @param {string} partyCode
 * @param {import('pg').Pool} p
 */
export async function findGuestByTokenForPartyCode(token, partyCode, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT g.*, s.party_code, s.id AS session_pk, s.status AS session_status, s.max_guests
     FROM party_guests g
     INNER JOIN party_sessions s ON s.id = g.session_id
     WHERE g.guest_token = $1::text AND s.party_code = $2::text`,
    [token, partyCode]
  )
  return rows[0] || null
}

/**
 * @param {string} token
 * @param {string} sessionId
 * @param {import('pg').Pool} p
 */
export async function findGuestByTokenForSessionId(token, sessionId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT g.*, s.party_code, s.id AS session_pk, s.status AS session_status, s.max_guests, s.host_id
     FROM party_guests g
     INNER JOIN party_sessions s ON s.id = g.session_id
     WHERE g.guest_token = $1::text AND s.id = $2::uuid`,
    [token, sessionId]
  )
  return rows[0] || null
}

/**
 * @param {string} guestId
 * @param {{ isConnected: boolean }} o
 * @param {import('pg').Pool | import('pg').PoolClient} p
 */
export async function updatePartyGuestConnectionState(guestId, o, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `UPDATE party_guests
     SET is_connected = $2::boolean,
         last_seen_at = now(),
         updated_at = now()
     WHERE id = $1::uuid
     RETURNING *`,
    [guestId, o.isConnected]
  )
  return rows[0] || null
}

/**
 * @param {{
 *  sessionId: string
 *  displayName: string
 *  languagePreference: 'english' | 'hindi' | 'hebrew'
 *  guestToken: string
 * }} o
 * @param {import('pg').Pool | import('pg').PoolClient} p
 */
export async function createGuest(o, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `INSERT INTO party_guests (session_id, display_name, language_preference, guest_token, is_connected, last_seen_at)
     VALUES ($1::uuid, btrim($2::text), $3::lyric_language, $4::text, true, now())
     RETURNING *`,
    [o.sessionId, o.displayName, o.languagePreference, o.guestToken]
  )
  return rows[0]
}
