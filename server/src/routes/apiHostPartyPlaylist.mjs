import { Router } from 'express'
import { findRequestByIdForHost } from '../db/repos/partyRequestsRepo.mjs'
import {
  endPartySessionForHost,
  findSessionByPartyRequestId,
  startPartySession,
  setCurrentControllerGuest,
  setControllerAudioEnabled
} from '../db/repos/partySessionsRepo.mjs'
import { appendEvent } from '../db/repos/partyEventsRepo.mjs'
import * as plRepo from '../db/repos/partyPlaylistItemsRepo.mjs'
import * as crRepo from '../db/repos/controlRequestsRepo.mjs'
import {
  isSongAllowedOnPartyPlaylist,
  listAvailableSongsForPartyPanel,
  listDefaultSuggestionSongs
} from '../db/repos/songsRepo.mjs'
import { buildBotSuggestions } from '../services/partySongBotSuggestions.mjs'
import { startPartySong, setPartySongPlaybackOp } from '../services/partySongControl.mjs'
import {
  emitControlAndPartyState,
  emitHostPartyEnded,
  emitPartyPlaylistUpdated,
  emitPartyKaraokeAndState,
  getPartySocketRoomName
} from '../services/partyRealtime.mjs'
import { buildPartyKaraokeState } from '../services/partyKaraokeState.mjs'
import { getIntSetting } from '../services/appSettingsService.mjs'
import { ensurePartyNotExpired } from '../services/partyExpiryService.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {import('express').Request} req
 */
function getSocketIo(/** @type {any} */ req) {
  return /** @type {import('socket.io').Server | undefined} */ (req.app.get('io'))
}

/**
 * @param {{ getPool: () => import('pg').Pool | null }} d
 */
export function createHostPartyPlaylistRouter(d) {
  const r = Router({ mergeParams: true })

  r.post('/:partyId/start-party', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const { pool, session } = out
      const current = String(session.status || '')
      if (current === 'active') {
        return res.json({ ok: true, session: { id: String(session.id), status: 'active' } })
      }
      if (current !== 'approved') {
        return res.status(400).json({ error: 'invalid_state' })
      }
      const updated = await startPartySession(String(session.id), pool)
      if (!updated) {
        return res.status(409).json({ error: 'already_started' })
      }
      const io = getSocketIo(req)
      const state = await buildPartyKaraokeState(String(session.id), pool, { role: 'host' })
      if (io && state) {
        io.to(getPartySocketRoomName(String(session.id))).emit('party:state', state)
      }
      return res.json({
        ok: true,
        session: { id: String(updated.id), status: String(updated.status) },
        state: state || null
      })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyId/start-song', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const { pool, session } = out
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const b = /** @type {Record<string, unknown>} */ (req.body) || {}
      const playlistItemId = String(b.playlistItemId ?? b.playlist_item_id ?? '')
      if (!UUID.test(playlistItemId)) {
        return res.status(400).json({ error: 'invalid_playlist_item' })
      }
      const st = await findSessionByPartyRequestId(String(/** @type {any} */ (req.params).partyId), pool)
      if (!st) {
        return res.status(404).json({ error: 'no_session' })
      }
      const result = await startPartySong(pool, { session: st, playlistItemId })
      if (!result.ok) {
        return res.status(400).json({ error: result.error })
      }
      const sessionId = String(/** @type {any} */ (result.state).sessionId)
      const io = getSocketIo(req)
      await emitPartyKaraokeAndState(io, d.getPool, sessionId, 'song:started', {
        activeSong: result.state?.activeSong ?? null,
        activePlaylistItemId: result.state?.activePlaylistItemId,
        playbackStatus: result.state?.playbackStatus
      })
      return res.json({ ok: true, state: result.state })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyId/pause-song', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const { pool } = out
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const st = await findSessionByPartyRequestId(String(/** @type {any} */ (req.params).partyId), pool)
      if (!st) {
        return res.status(404).json({ error: 'no_session' })
      }
      const result = await setPartySongPlaybackOp(pool, st, 'pause')
      if (!result.ok) {
        const c = result.error === 'no_active_song' ? 409 : 400
        return res.status(c).json({ error: result.error })
      }
      const sessionId = String(/** @type {any} */ (result.state).sessionId)
      const io = getSocketIo(req)
      await emitPartyKaraokeAndState(io, d.getPool, sessionId, 'song:paused', {
        playbackStatus: 'paused',
        activeSong: result.state?.activeSong,
        activePlaylistItemId: result.state?.activePlaylistItemId
      })
      return res.json({ ok: true, state: result.state })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyId/resume-song', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const { pool } = out
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const st = await findSessionByPartyRequestId(String(/** @type {any} */ (req.params).partyId), pool)
      if (!st) {
        return res.status(404).json({ error: 'no_session' })
      }
      const result = await setPartySongPlaybackOp(pool, st, 'resume')
      if (!result.ok) {
        const c = result.error === 'no_active_song' || result.error === 'invalid_state' ? 409 : 400
        return res.status(c).json({ error: result.error })
      }
      const sessionId = String(/** @type {any} */ (result.state).sessionId)
      const io = getSocketIo(req)
      await emitPartyKaraokeAndState(io, d.getPool, sessionId, 'song:resumed', {
        playbackStatus: 'playing',
        activeSong: result.state?.activeSong,
        activePlaylistItemId: result.state?.activePlaylistItemId
      })
      return res.json({ ok: true, state: result.state })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyId/end-song', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const { pool } = out
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const st = await findSessionByPartyRequestId(String(/** @type {any} */ (req.params).partyId), pool)
      if (!st) {
        return res.status(404).json({ error: 'no_session' })
      }
      const result = await setPartySongPlaybackOp(pool, st, 'end')
      if (!result.ok) {
        const c = result.error === 'no_active_song' ? 409 : 400
        return res.status(c).json({ error: result.error })
      }
      const sessionId = String(/** @type {any} */ (result.state).sessionId)
      const io = getSocketIo(req)
      await emitPartyKaraokeAndState(io, d.getPool, sessionId, 'song:finished', {
        playbackStatus: 'idle',
        activeSong: null,
        activePlaylistItemId: null
      })
      return res.json({ ok: true, state: result.state })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyId/end-party', async (req, res, next) => {
    try {
      const id = String(/** @type {any} */ (req.params).partyId || '')
      if (!UUID.test(id)) {
        return res.status(400).json({ error: 'invalid_party_id' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const u = /** @type {{ id: string }} */ (req.funsongUser)
      const out = await endPartySessionForHost(id, u.id, pool)
      if (!out.ok) {
        const m =
          out.error === 'not_found' || out.error === 'no_session'
            ? 404
            : out.error === 'already_closed'
              ? 409
              : 400
        return res.status(m).json({ error: out.error })
      }
      const sessionId = String(/** @type {any} */ (out.session).id)
      try {
        await appendEvent(
          {
            sessionId,
            eventType: 'party_ended',
            payload: { source: 'host', hostUserId: u.id }
          },
          pool
        )
      } catch {
        // ignore log failure
      }
      const io = getSocketIo(req)
      await emitHostPartyEnded(io, d.getPool, sessionId)
      return res.json({
        ok: true,
        session: { id: sessionId, status: 'ended' }
      })
    } catch (e) {
      return next(e)
    }
  })

  r.get('/:partyId/control-requests', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const { pool, session } = out
      const rows = await crRepo.listPendingBySessionId(String(session.id), pool)
      return res.json({
        partySessionId: String(session.id),
        requests: rows.map((r) => ({
          id: String(/** @type {any} */ (r).id),
          partyGuestId: String(/** @type {any} */ (r).party_guest_id),
          guestDisplayName: String(/** @type {any} */ (r).guest_display_name),
          songId: /** @type {any} */ (r).song_id ? String(/** @type {any} */ (r).song_id) : null,
          playlistItemId: /** @type {any} */ (r).playlist_item_id
            ? String(/** @type {any} */ (r).playlist_item_id)
            : null,
          songTitle: /** @type {any} */ (r).song_title
            ? String(/** @type {any} */ (r).song_title)
            : null,
          createdAt: /** @type {any} */ (r).created_at
        }))
      })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyId/controller-audio', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const { pool, session } = out
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const b = /** @type {Record<string, unknown>} */ (req.body) || {}
      const enabled = Boolean(b.enabled ?? b.controllerAudioEnabled)
      const upd = await setControllerAudioEnabled(String(session.id), enabled, pool)
      if (!upd) {
        return res.status(500).json({ error: 'update_failed' })
      }
      const io = getSocketIo(req)
      const state = await buildPartyKaraokeState(String(session.id), pool, { role: 'host' })
      if (io && state) {
        io.to(getPartySocketRoomName(String(session.id))).emit('party:state', state)
      }
      return res.json({ ok: true, controllerAudioEnabled: enabled, state })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyId/take-control', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const { pool, session } = out
      const sessionId = String(session.id)
      const prev = session.current_controller_party_guest_id
        ? String(session.current_controller_party_guest_id)
        : null
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        await setCurrentControllerGuest(sessionId, null, c)
        await crRepo.rejectAllPendingForSession(sessionId, c)
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
        await appendEvent(
          {
            sessionId,
            eventType: 'control_taken_back',
            payload: {
              source: 'host',
              previousPartyGuestId: prev
            }
          },
          pool
        )
      } catch {
        // ignore log failure
      }
      const io = getSocketIo(req)
      await emitControlAndPartyState(io, d.getPool, sessionId, 'control:revoked', {
        previousPartyGuestId: prev
      })
      return res.json({ ok: true })
    } catch (e) {
      return next(e)
    }
  })

  r.get('/:partyId/song-requests', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const { session, pool } = out
      const rows = await crRepo.listPendingSongRequestsBySessionId(String(session.id), pool)
      return res.json({
        requests: rows.map((r) => ({
          id: String(r.id),
          partyGuestId: String(r.party_guest_id),
          guestDisplayName: String(r.guest_display_name || 'Guest'),
          songId: String(r.song_id),
          songTitle: String(r.song_title || 'Unknown'),
          status: String(r.status),
          createdAt: r.created_at
        }))
      })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyId/song-requests/:requestId/approve', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const requestId = String(req.params.requestId || '')
      if (!UUID.test(requestId)) {
        return res.status(400).json({ error: 'invalid_request_id' })
      }
      const { pool, session } = out
      const c = await pool.connect()
      let reqRow
      try {
        await c.query('BEGIN')
        reqRow = await crRepo.approveSongRequestById(requestId, String(req.funsongUser?.id || ''), c)
        if (!reqRow) {
          await c.query('ROLLBACK')
          return res.status(409).json({ error: 'not_pending' })
        }
        if (String(reqRow.session_id) !== String(session.id)) {
          await c.query('ROLLBACK')
          return res.status(403).json({ error: 'mismatch' })
        }
        const songId = String(reqRow.song_id || '')
        if (!songId || !UUID.test(songId)) {
          await c.query('ROLLBACK')
          return res.status(400).json({ error: 'invalid_song_id' })
        }
        if (!(await plRepo.hasSongInSessionPlaylist(String(session.id), songId, c))) {
          const maxPlaylistSongs = await getIntSetting('max_playlist_songs', 10, c)
          const playlist = await plRepo.listPlaylistWithSongsForSession(String(session.id), c)
          if (playlist.length >= maxPlaylistSongs) {
            await c.query('ROLLBACK')
            return res.status(409).json({ error: 'queue_full' })
          }
          const pos = await plRepo.nextPositionAtEnd(String(session.id), c)
          await plRepo.addSongAtPosition(
            {
              sessionId: String(session.id),
              songId,
              position: pos,
              requestedByGuestId: reqRow.party_guest_id ? String(reqRow.party_guest_id) : null
            },
            c
          )
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
      const io = getSocketIo(req)
      const playlist = await plRepo.listPlaylistWithSongsForSession(String(session.id), pool)
      emitPartyPlaylistUpdated(io, String(session.id), {
        source: 'song_request:approved',
        playlist
      })
      await emitControlAndPartyState(io, d.getPool, String(session.id), 'control:approved', {
        requestId
      })
      return res.json({ ok: true })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyId/song-requests/:requestId/reject', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const requestId = String(req.params.requestId || '')
      if (!UUID.test(requestId)) {
        return res.status(400).json({ error: 'invalid_request_id' })
      }
      const { pool, session } = out
      const c = await pool.connect()
      let reqRow
      try {
        reqRow = await crRepo.rejectSongRequestById(requestId, c)
      } finally {
        c.release()
      }
      if (!reqRow) {
        return res.status(409).json({ error: 'not_pending' })
      }
      if (String(reqRow.session_id) !== String(session.id)) {
        return res.status(403).json({ error: 'mismatch' })
      }
      const io = getSocketIo(req)
      await emitControlAndPartyState(io, d.getPool, String(session.id), 'control:rejected', {
        requestId
      })
      return res.json({ ok: true })
    } catch (e) {
      return next(e)
    }
  })

  r.get('/:partyId/playlist', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const { pool, session, partyRequest } = out
      const [playlist, availableSongs, suggestions, botSuggestions] = await Promise.all([
        plRepo.listPlaylistWithSongsForSession(session.id, pool),
        listAvailableSongsForPartyPanel(pool),
        listDefaultSuggestionSongs(pool),
        buildBotSuggestions(pool, String(session.id), {
          description: partyRequest?.description,
          partyName: partyRequest?.party_name,
          limit: 20
        })
      ])
      const maxPlaylistSongs = await getIntSetting('max_playlist_songs', 10, pool)
      const storedMaxGuests = Number(session.max_guests)
      const maxGuests = Number.isFinite(storedMaxGuests) && storedMaxGuests > 0
        ? storedMaxGuests
        : await getIntSetting('max_party_guests', 30, pool)
      return res.json({
        partySessionId: String(session.id),
        playlist,
        maxPlaylistSongs,
        maxGuests,
        availableSongs: availableSongs.map((s) => ({
          id: s.id,
          title: s.title,
          difficulty: s.difficulty,
          tags: s.tags,
          audioReady: s.audioReady,
          lyricsReady: s.lyricsReady
        })),
        botSuggestions,
        suggestions: suggestions.map((s) => ({
          id: s.id,
          title: s.title,
          difficulty: s.difficulty,
          tags: s.tags,
          audioReady: s.audioReady,
          lyricsReady: s.lyricsReady,
          isDefaultSuggestion: s.isDefaultSuggestion
        }))
      })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyId/playlist/add', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const { pool, session } = out
      const b = /** @type {Record<string, unknown>} */ (req.body) || {}
      const songId = String(b.songId ?? b.song_id ?? '')
      if (!UUID.test(songId)) {
        return res.status(400).json({ error: 'invalid_song_id' })
      }
      const allowed = await isSongAllowedOnPartyPlaylist(songId, pool)
      if (!allowed) {
        return res.status(400).json({ error: 'song_not_allowed' })
      }
      if (await plRepo.hasSongInSessionPlaylist(session.id, songId, pool)) {
        return res.status(409).json({ error: 'duplicate_song' })
      }
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        await c.query(
          'SELECT id FROM party_sessions WHERE id = $1::uuid FOR UPDATE',
          [session.id]
        )
        const maxPlaylistSongs = await getIntSetting('max_playlist_songs', 10, c)
        const existingPlaylist = await plRepo.listPlaylistWithSongsForSession(session.id, c)
        if (existingPlaylist.length >= maxPlaylistSongs) {
          await c.query('ROLLBACK')
          return res.status(409).json({ error: 'queue_full' })
        }
        const pos = await plRepo.nextPositionAtEnd(session.id, c)
        let row
        try {
          row = await plRepo.addSongAtPosition(
            { sessionId: session.id, songId, position: pos },
            c
          )
        } catch (e) {
          if (/** @type {any} */ (e).code === '23505') {
            await c.query('ROLLBACK')
            return res.status(409).json({ error: 'duplicate_song' })
          }
          throw e
        }
        await c.query('COMMIT')
        if (!row) {
          return res.status(500).json({ error: 'insert_failed' })
        }
        const playlist = await plRepo.listPlaylistWithSongsForSession(session.id, pool)
        emitPartyPlaylistUpdated(getSocketIo(req), String(session.id), {
          source: 'host:add',
          playlist
        })
        return res.status(201).json({ playlist, added: row.id })
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
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyId/playlist/remove', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const { pool, session } = out
      const b = /** @type {Record<string, unknown>} */ (req.body) || {}
      const itemId = String(b.playlistItemId ?? b.playlist_item_id ?? '')
      if (!UUID.test(itemId)) {
        return res.status(400).json({ error: 'invalid_item' })
      }
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        const del = await plRepo.deleteItemForSession(session.id, itemId, c)
        if (!del) {
          await c.query('ROLLBACK')
          return res.status(404).json({ error: 'not_found' })
        }
        await plRepo.compactPositions(session.id, c)
        await c.query('COMMIT')
        const playlist = await plRepo.listPlaylistWithSongsForSession(session.id, pool)
        emitPartyPlaylistUpdated(getSocketIo(req), String(session.id), {
          source: 'host:remove',
          playlist
        })
        return res.json({ playlist })
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
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyId/playlist/reorder', async (req, res, next) => {
    try {
      const out = await resolveHostSession(req, d)
      if (out.error) {
        return res.status(out.error).json({ error: out.body?.error || 'forbidden' })
      }
      const { pool, session } = out
      const b = /** @type {Record<string, unknown>} */ (req.body) || {}
      const ord = b.orderedItemIds ?? b.ordered_item_ids
      if (!Array.isArray(ord) || !ord.length) {
        return res.status(400).json({ error: 'orderedItemIds_required' })
      }
      const ids = ord.map((x) => String(x))
      if (ids.some((x) => !UUID.test(x))) {
        return res.status(400).json({ error: 'invalid_id' })
      }
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        const ok = await plRepo.reorderByItemIds(session.id, ids, c)
        if (!ok) {
          await c.query('ROLLBACK')
          return res.status(400).json({ error: 'reorder_mismatch' })
        }
        await c.query('COMMIT')
        const playlist = await plRepo.listPlaylistWithSongsForSession(session.id, pool)
        emitPartyPlaylistUpdated(getSocketIo(req), String(session.id), {
          source: 'host:reorder',
          playlist
        })
        return res.json({ playlist })
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
    } catch (e) {
      return next(e)
    }
  })

  return r
}

/**
 * @param {import('express').Request} req
 * @param {{ getPool: () => import('pg').Pool | null }} d
 * @returns {Promise<{
 *   error?: number
 *   body?: { error: string }
 *   session?: any
 *   pool: import('pg').Pool
 *   partyRequest?: import('pg').QueryResultRow | null
 * }>}
 */
async function resolveHostSession(req, d) {
  const partyId = String(/** @type {Record<string, string>} */ (req.params).partyId || '')
  if (!UUID.test(partyId)) {
    return { error: 400, body: { error: 'invalid_party_id' }, pool: /** @type {any} */ (null) }
  }
  const pool = d.getPool()
  if (!pool) {
    return { error: 503, body: { error: 'no_database' }, pool: /** @type {any} */ (null) }
  }
  await ensurePartyNotExpired({
    getPool: d.getPool,
    io: /** @type {import('socket.io').Server | undefined} */ (req.app.get('io')),
    partyRequestId: partyId
  })
  const u = /** @type {{ id: string }} */ (req.funsongUser)
  const pr = await findRequestByIdForHost(partyId, u.id, pool)
  if (!pr) {
    return { error: 404, body: { error: 'not_found' }, pool }
  }
  if (pr.status !== 'approved') {
    return { error: 403, body: { error: 'not_approved' }, pool }
  }
  const session = await findSessionByPartyRequestId(partyId, pool)
  if (!session) {
    return { error: 404, body: { error: 'no_session' }, pool }
  }
  const st = String(/** @type {any} */ (session).status || '')
  if (st === 'disabled') {
    return { error: 403, body: { error: 'session_disabled' }, pool }
  }
  if (st === 'ended') {
    return { error: 403, body: { error: 'party_ended' }, pool }
  }
  return { session, pool, partyRequest: pr }
}
