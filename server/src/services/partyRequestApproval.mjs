import { generateJoinToken, generateUniquePartyCode } from './partyCodes.mjs'

/**
 * @param {import('pg').Pool} pool
 * @param {string} requestId
 * @param {string} adminUserId
 * @returns {Promise<
 *  | { ok: true; session: Record<string, unknown> }
 *  | { ok: false; error: 'not_found_or_not_pending' | 'already_approved' }
 * >}
 */
export async function approvePartyRequest(pool, requestId, adminUserId) {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const { rows } = await c.query(
      `SELECT * FROM party_requests WHERE id = $1::uuid AND status = 'pending' FOR UPDATE`,
      [requestId]
    )
    const r = rows[0]
    if (!r) {
      await c.query('ROLLBACK')
      return { ok: false, error: 'not_found_or_not_pending' }
    }
    const { rowCount: existingSess } = await c.query(
      'SELECT 1 FROM party_sessions WHERE party_request_id = $1::uuid',
      [requestId]
    )
    if (existingSess) {
      await c.query('ROLLBACK')
      return { ok: false, error: 'already_approved' }
    }
    const partyCode = await generateUniquePartyCode(c)
    const joinToken = generateJoinToken()
    const cap = Math.min(100, Math.max(1, Number(r.expected_guests) || 30))
    const title = r.party_name || 'Party'
    const { rows: sessRows } = await c.query(
      `INSERT INTO party_sessions (
         party_request_id, host_id, title, join_code, max_guests, status, playback_status,
         party_code, join_token
       ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'approved', 'idle', $4, $6)
       RETURNING *`,
      [r.id, r.host_id, title, partyCode, cap, joinToken]
    )
    const session = sessRows[0]
    await c.query(
      `UPDATE party_requests SET
         status = 'approved',
         approved_by = $2::uuid,
         approved_at = now(),
         reviewed_by = $2::uuid,
         reviewed_at = now(),
         updated_at = now()
       WHERE id = $1::uuid`,
      [r.id, adminUserId]
    )
    await c.query('COMMIT')
    return { ok: true, session }
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

/**
 * @param {import('pg').Pool} pool
 * @param {string} requestId
 * @param {string} reason
 * @param {string} adminUserId
 * @returns {Promise<
 *  { ok: true; request: unknown } | { ok: false; error: 'not_found_or_not_pending' }
 * >}
 */
export async function rejectPartyRequest(pool, requestId, reason, adminUserId) {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const { rows, rowCount } = await c.query(
      `UPDATE party_requests
       SET
         status = 'rejected',
         rejection_reason = $2,
         reviewed_by = $3::uuid,
         reviewed_at = now(),
         updated_at = now()
       WHERE id = $1::uuid AND status = 'pending'
       RETURNING *`,
      [requestId, String(reason).trim() || 'No reason given', adminUserId]
    )
    if (rowCount === 0) {
      await c.query('ROLLBACK')
      return { ok: false, error: 'not_found_or_not_pending' }
    }
    const request = rows[0]
    await c.query('COMMIT')
    return { ok: true, request }
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
