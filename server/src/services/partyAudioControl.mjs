import { findSessionById } from '../db/repos/partySessionsRepo.mjs'
import { setPartySongPlaybackOp } from './partySongControl.mjs'
import { sessionAllowsLivePartyControl } from './partySessionPolicy.mjs'

/**
 * Host or admin may always control whether party audio (playback_status) is playing/paused.
 * A guest may only if they are the current controller and the host turned on controller audio.
 *
 * @param {Record<string, unknown>} session
 * @param {{ role: 'guest' | 'host' | 'admin'; partyGuestId: string | null }} a
 */
export function canControlPartyAudio(session, a) {
  const { role, partyGuestId } = a
  if (role === 'host' || role === 'admin') {
    return true
  }
  if (role === 'guest' && partyGuestId && session.current_controller_party_guest_id) {
    if (String(session.current_controller_party_guest_id) !== String(partyGuestId)) {
      return false
    }
    return /** @type {any} */ (session).controller_audio_enabled === true
  }
  return false
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} sessionId
 * @param {'pause' | 'resume'} op
 */
export async function applyPartyAudioPlaybackOp(pool, sessionId, op) {
  if (!pool) {
    return { ok: false, error: 'no_database' }
  }
  const session = await findSessionById(sessionId, pool)
  if (!session) {
    return { ok: false, error: 'not_found' }
  }
  if (!sessionAllowsLivePartyControl(session)) {
    return { ok: false, error: 'session_closed' }
  }
  if (op !== 'pause' && op !== 'resume') {
    return { ok: false, error: 'invalid_op' }
  }
  const r = await setPartySongPlaybackOp(
    pool,
    session,
    op === 'pause' ? 'pause' : 'resume'
  )
  if (!r.ok) {
    return { ok: false, error: String(r.error) }
  }
  return { ok: true, state: r.state }
}
