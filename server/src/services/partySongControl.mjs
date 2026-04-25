import { listLinesForSong } from '../db/repos/lyricLinesRepo.mjs'
import * as plRepo from '../db/repos/partyPlaylistItemsRepo.mjs'
import { appendEvent } from '../db/repos/partyEventsRepo.mjs'
import { isSongAllowedOnPartyPlaylist } from '../db/repos/songsRepo.mjs'
import { buildPartyKaraokeState } from './partyKaraokeState.mjs'
import { sessionAllowsLivePartyControl } from './partySessionPolicy.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {import('pg').Pool} pool
 * @param {{ session: Record<string, unknown>; playlistItemId: string }} a
 * @returns {Promise<{ ok: true; state: Awaited<ReturnType<typeof buildPartyKaraokeState>> } | { ok: false; error: string }>}
 */
export async function startPartySong(pool, a) {
  if (!pool) {
    return { ok: false, error: 'no_database' }
  }
  const { session, playlistItemId } = a
  if (!UUID.test(playlistItemId)) {
    return { ok: false, error: 'invalid_playlist_item' }
  }
  const item = await plRepo.findPlaylistItemById(playlistItemId, pool)
  if (!item) {
    return { ok: false, error: 'not_found' }
  }
  if (String(item.session_id) !== String(session.id)) {
    return { ok: false, error: 'mismatch' }
  }
  if (!sessionAllowsLivePartyControl(session)) {
    return { ok: false, error: 'session_closed' }
  }
  const songId = String(/** @type {any} */ (item).song_id)
  const allowed = await isSongAllowedOnPartyPlaylist(songId, pool)
  if (!allowed) {
    return { ok: false, error: 'song_not_available' }
  }
  const lines = await listLinesForSong(songId, pool)
  const hasLine1 = lines.some((l) => l.lineNumber === 1)
  const minLine = lines.length ? Math.min(...lines.map((l) => l.lineNumber)) : 1
  const currentLine = hasLine1 ? 1 : minLine
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const ok = await plRepo.setPlaylistItemsForStart(String(session.id), playlistItemId, c)
    if (!ok) {
      await c.query('ROLLBACK')
      return { ok: false, error: 'playlist_update_failed' }
    }
    const { rows: upd } = await c.query(
      `UPDATE party_sessions
       SET
         status = 'active'::party_session_status,
         active_song_id = $1::uuid,
         active_playlist_item_id = $2::uuid,
         current_line_number = $3::int,
         playback_status = 'playing'::playback_status,
         updated_at = now()
       WHERE id = $4::uuid
       RETURNING *`,
      [songId, playlistItemId, currentLine, String(session.id)]
    )
    await c.query('COMMIT')
    const srow = upd[0] || { ...session, id: session.id }
    try {
      await appendEvent(
        {
          sessionId: String(srow.id),
          eventType: 'karaoke:song_started',
          payload: { playlistItemId, songId, currentLine }
        },
        pool
      )
    } catch {
      // ignore
    }
    const state = await buildPartyKaraokeState(String(srow.id), pool, { role: 'host' })
    return { ok: true, state }
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
 * @param {Record<string, unknown>} session
 * @param {'pause' | 'resume' | 'end'} op
 */
export async function setPartySongPlaybackOp(pool, session, op) {
  if (!pool) {
    return { ok: false, error: 'no_database' }
  }
  const id = String(session.id)
  if (op === 'pause') {
    if (String(/** @type {any} */ (session).playback_status) !== 'playing') {
      return { ok: false, error: 'invalid_state' }
    }
    const { rows } = await pool.query(
      `UPDATE party_sessions
       SET playback_status = 'paused'::playback_status, updated_at = now()
       WHERE id = $1::uuid AND active_playlist_item_id IS NOT NULL
       RETURNING *`,
      [id]
    )
    if (!rows[0]) {
      return { ok: false, error: 'no_active_song' }
    }
    try {
      await appendEvent({ sessionId: id, eventType: 'karaoke:paused', payload: {} }, pool)
    } catch {
      // ignore
    }
    return { ok: true, state: await buildPartyKaraokeState(id, pool, { role: 'host' }) }
  }
  if (op === 'resume') {
    if (String(/** @type {any} */ (session).playback_status) !== 'paused') {
      return { ok: false, error: 'invalid_state' }
    }
    const { rows } = await pool.query(
      `UPDATE party_sessions
       SET playback_status = 'playing'::playback_status, updated_at = now()
       WHERE id = $1::uuid AND active_playlist_item_id IS NOT NULL
       RETURNING *`,
      [id]
    )
    if (!rows[0]) {
      return { ok: false, error: 'no_active_song' }
    }
    try {
      await appendEvent({ sessionId: id, eventType: 'karaoke:resumed', payload: {} }, pool)
    } catch {
      // ignore
    }
    return { ok: true, state: await buildPartyKaraokeState(id, pool, { role: 'host' }) }
  }
  if (op === 'end') {
    if (!/** @type {any} */ (session).active_playlist_item_id) {
      return { ok: false, error: 'no_active_song' }
    }
    const plId = String(/** @type {any} */ (session).active_playlist_item_id)
    const c = await pool.connect()
    try {
      await c.query('BEGIN')
      await plRepo.setPlaylistItemStatus(plId, 'finished', c)
      const { rows } = await c.query(
        `UPDATE party_sessions
         SET
           active_song_id = NULL,
           active_playlist_item_id = NULL,
           current_line_number = 1,
           current_controller_party_guest_id = NULL,
           controller_audio_enabled = FALSE,
           playback_status = 'idle'::playback_status,
           updated_at = now()
         WHERE id = $1::uuid
         RETURNING *`,
        [id]
      )
      if (!rows[0]) {
        await c.query('ROLLBACK')
        return { ok: false, error: 'not_found' }
      }
      await c.query('COMMIT')
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
    try {
      await appendEvent({ sessionId: id, eventType: 'karaoke:song_ended', payload: {} }, pool)
    } catch {
      // ignore
    }
    return { ok: true, state: await buildPartyKaraokeState(id, pool, { role: 'host' }) }
  }
  return { ok: false, error: 'invalid_op' }
}
