import { createGuest, countConnectedGuestsBySessionId } from '../db/repos/partyGuestsRepo.mjs'
import { findSessionByPartyCode } from '../db/repos/partySessionsRepo.mjs'

const LANG = new Set(['english', 'hindi', 'hebrew'])

const ALLOW = new Set(['approved', 'active'])
const BLOCK = new Set(['disabled', 'ended'])

/**
 * @param {import('pg').Pool} pool
 * @param {string} partyCode
 * @param {{ displayName: string; language: string; guestToken: string }} p
 * @returns {Promise<
 *  | { ok: true; session: object; guest: object }
 *  | { ok: false; error: 'not_found' | 'not_joinable' | 'full' | 'invalid_language' }
 * >}
 */
export async function performGuestJoin(pool, partyCode, p) {
  if (!LANG.has(p.language)) {
    return { ok: false, error: 'invalid_language' }
  }
  const d = p.displayName?.trim()
  if (!d || d.length < 1) {
    return { ok: false, error: 'invalid_name' }
  }
  if (d.length > 100) {
    return { ok: false, error: 'invalid_name' }
  }
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const { rows } = await c.query(
      'SELECT * FROM party_sessions WHERE party_code = $1::text FOR UPDATE',
      [partyCode]
    )
    const s = rows[0]
    if (!s) {
      await c.query('ROLLBACK')
      return { ok: false, error: 'not_found' }
    }
    if (BLOCK.has(s.status)) {
      await c.query('ROLLBACK')
      return { ok: false, error: 'not_joinable' }
    }
    if (!ALLOW.has(s.status)) {
      await c.query('ROLLBACK')
      return { ok: false, error: 'not_joinable' }
    }
    const n = await countConnectedGuestsBySessionId(s.id, c)
    if (n >= s.max_guests) {
      await c.query('ROLLBACK')
      return { ok: false, error: 'full' }
    }
    const guest = await createGuest(
      {
        sessionId: s.id,
        displayName: d,
        languagePreference: /** @type {'english' | 'hindi' | 'hebrew'} */ (p.language),
        guestToken: p.guestToken
      },
      c
    )
    await c.query('COMMIT')
    return { ok: true, session: s, guest }
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
 * Read-only: session + count for join UI
 * @param {import('pg').Pool} pool
 * @param {string} partyCode
 */
export async function getJoinPreview(pool, partyCode) {
  const s = await findSessionByPartyCode(partyCode, pool)
  if (!s) {
    return { found: false }
  }
  const n = await countConnectedGuestsBySessionId(s.id, pool)
  if (BLOCK.has(s.status) || !ALLOW.has(s.status)) {
    return {
      found: true,
      canJoin: false,
      full: false,
      reason: s.status,
      status: s.status,
      partyTitle: s.title,
      currentGuests: n,
      maxGuests: s.max_guests
    }
  }
  const atCapacity = n >= s.max_guests
  return {
    found: true,
    canJoin: !atCapacity,
    full: atCapacity,
    reason: atCapacity ? 'full' : null,
    status: s.status,
    partyTitle: s.title,
    currentGuests: n,
    maxGuests: s.max_guests
  }
}
