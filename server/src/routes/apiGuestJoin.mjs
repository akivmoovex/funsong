import { Router } from 'express'
import {
  findGuestByTokenForPartyCode,
  updatePartyGuestConnectionState
} from '../db/repos/partyGuestsRepo.mjs'
import {
  readGuestTokenFromRequest,
  setGuestTokenCookie,
  clearGuestTokenCookie,
  newGuestToken
} from '../guest/cookies.mjs'
import { getJoinPreview, performGuestJoin } from '../services/guestJoin.mjs'
import { findSessionByPartyCode } from '../db/repos/partySessionsRepo.mjs'
import { setCurrentControllerGuest } from '../db/repos/partySessionsRepo.mjs'
import {
  getSongStreamMeta,
  isSongAllowedOnPartyPlaylist,
  listAvailableSongsForPartyPanel
} from '../db/repos/songsRepo.mjs'
import { listLinesForSong } from '../db/repos/lyricLinesRepo.mjs'
import { buildPartyKaraokeState } from '../services/partyKaraokeState.mjs'
import { pickLineTextForLanguage } from '../services/partyKaraokeState.mjs'
import { streamAudioFileToResponse } from '../audio/streamFile.mjs'
import * as plRepo from '../db/repos/partyPlaylistItemsRepo.mjs'
import * as crRepo from '../db/repos/controlRequestsRepo.mjs'
import { emitControlAndPartyState, emitPartyGuestsUpdated } from '../services/partyRealtime.mjs'
import { ensurePartyNotExpired } from '../services/partyExpiryService.mjs'

const PC = /^[A-Za-z0-9._-]{4,64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {string | null | undefined} itemStatus
 */
function mapGuestPlaylistStatus(itemStatus) {
  const raw = String(itemStatus || 'pending').toLowerCase()
  if (raw === 'active') return 'active'
  if (raw === 'finished') return 'completed'
  if (raw === 'skipped') return 'skipped'
  return 'queued'
}

/**
 * @param {unknown} x
 * @returns {'english' | 'hindi' | 'hebrew'}
 */
function normalizeGuestLanguage(x) {
  const raw = String(x || '').toLowerCase()
  if (raw === 'hindi') return 'hindi'
  if (raw === 'hebrew') return 'hebrew'
  return 'english'
}

/**
 * @param {{
 *   getPool: () => import('pg').Pool | null
 *   rateLimitPostJoin?: import('express').RequestHandler
 * }} d
 */
export function createGuestJoinRouter(d) {
  const r = Router()
  const postJoin = d.rateLimitPostJoin

  r.get('/:partyCode', async (req, res, next) => {
    try {
      const code = String(req.params.partyCode || '')
      if (!PC.test(code)) {
        return res.status(400).json({ error: 'invalid_party_code' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      await ensurePartyNotExpired({
        getPool: d.getPool,
        io: /** @type {import('socket.io').Server | undefined} */ (req.app.get('io')),
        partyCode: code
      })
      const preview = await getJoinPreview(pool, code)
      if (!preview.found) {
        return res.status(404).json({ error: 'party_not_found' })
      }
      return res.json({ preview })
    } catch (e) {
      return next(e)
    }
  })

  r.post(
    '/:partyCode',
    postJoin || ((req, res, next) => next()),
    async (req, res, next) => {
      try {
        const code = String(req.params.partyCode || '')
        if (!PC.test(code)) {
          return res.status(400).json({ error: 'invalid_party_code' })
        }
        const pool = d.getPool()
        if (!pool) {
          return res.status(503).json({ error: 'no_database' })
        }
        await ensurePartyNotExpired({
          getPool: d.getPool,
          io: /** @type {import('socket.io').Server | undefined} */ (req.app.get('io')),
          partyCode: code
        })
        const b = /** @type {Record<string, unknown>} */ (req.body) || {}
        const displayName = String(b.displayName ?? b.display_name ?? '')
        const language = String(
          b.language ?? b.languagePreference ?? b.language_preference ?? ''
        ).toLowerCase()
        const token = newGuestToken()
        const out = await performGuestJoin(pool, code, { displayName, language, guestToken: token })
        if (!out.ok) {
          if (out.error === 'invalid_language') {
            return res.status(400).json({ error: 'invalid_language' })
          }
          if (out.error === 'invalid_name') {
            return res.status(400).json({ error: 'invalid_name' })
          }
          if (out.error === 'not_found') {
            return res.status(404).json({ error: 'party_not_found' })
          }
          if (out.error === 'not_joinable') {
            return res.status(403).json({ error: 'not_joinable' })
          }
          if (out.error === 'full') {
            return res.status(409).json({ error: 'party_full' })
          }
          return res.status(400).json({ error: 'join_failed' })
        }
        setGuestTokenCookie(res, token)
        return res.status(201).json({
          ok: true,
          redirect: `/party/${encodeURIComponent(code)}`,
          guest: {
            id: out.guest.id,
            displayName: out.guest.display_name
          }
        })
      } catch (e) {
        return next(e)
      }
    }
  )

  return r
}

/**
 * @param {{
 *   getPool: () => import('pg').Pool | null
 *   rateLimitPostActions?: import('express').RequestHandler
 * }} d
 */
export function createPartyGuestRouter(d) {
  const r = Router()
  const rateAct = d.rateLimitPostActions
  const withRate = rateAct
    ? (req, res, next) => {
        rateAct(req, res, next)
      }
    : (req, res, next) => next()

  r.get('/:partyCode/state', async (req, res, next) => {
    try {
      const code = String(req.params.partyCode || '')
      if (!PC.test(code)) {
        return res.status(400).json({ error: 'invalid_party_code' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      await ensurePartyNotExpired({
        getPool: d.getPool,
        io: /** @type {import('socket.io').Server | undefined} */ (req.app.get('io')),
        partyCode: code
      })
      const tok = readGuestTokenFromRequest(req)
      if (!tok) {
        return res.status(401).json({ error: 'no_guest_session' })
      }
      const row = await findGuestByTokenForPartyCode(tok, code, pool)
      if (!row) {
        return res.status(401).json({ error: 'invalid_guest_session' })
      }
      const s = await findSessionByPartyCode(code, pool)
      if (!s) {
        return res.status(404).json({ error: 'party_not_found' })
      }
      if (String(row.session_pk) !== String(s.id)) {
        return res.status(403).json({ error: 'mismatch' })
      }
      if (s.status === 'ended' || s.status === 'disabled') {
        return res.status(403).json({ error: 'not_available' })
      }
      const lang = /** @type {'english'|'hindi'|'hebrew'} */ (
        String(row.language_preference || 'english') === 'hindi'
          ? 'hindi'
          : String(row.language_preference) === 'hebrew'
            ? 'hebrew'
            : 'english'
      )
      const state = await buildPartyKaraokeState(String(s.id), pool, { languagePreference: lang })
      if (!state) {
        return res.status(500).json({ error: 'state' })
      }
      return res.json({ state })
    } catch (e) {
      return next(e)
    }
  })

  r.get('/:partyCode/active-song-audio', async (req, res, next) => {
    try {
      const code = String(req.params.partyCode || '')
      if (!PC.test(code)) {
        return res.status(400).json({ error: 'invalid_party_code' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      await ensurePartyNotExpired({
        getPool: d.getPool,
        io: /** @type {import('socket.io').Server | undefined} */ (req.app.get('io')),
        partyCode: code
      })
      const tok = readGuestTokenFromRequest(req)
      if (!tok) {
        return res.status(401).json({ error: 'no_guest_session' })
      }
      const g = await findGuestByTokenForPartyCode(tok, code, pool)
      if (!g) {
        return res.status(401).json({ error: 'invalid_guest_session' })
      }
      const session = await findSessionByPartyCode(code, pool)
      if (!session) {
        return res.status(404).json({ error: 'party_not_found' })
      }
      if (String(g.session_pk) !== String(session.id)) {
        return res.status(403).json({ error: 'mismatch' })
      }
      if (session.status === 'ended' || session.status === 'disabled') {
        return res.status(403).json({ error: 'not_available' })
      }
      if (!/** @type {any} */ (session).active_song_id) {
        return res.status(404).json({ error: 'no_active_song' })
      }
      if (/** @type {any} */ (session).controller_audio_enabled !== true) {
        return res.status(403).json({ error: 'controller_audio_disabled' })
      }
      if (
        String(/** @type {any} */ (session).current_controller_party_guest_id || '') !== String(g.id)
      ) {
        return res.status(403).json({ error: 'not_controller' })
      }
      const songId = String(/** @type {any} */ (session).active_song_id)
      const meta = await getSongStreamMeta(songId, pool)
      if (!meta || !meta.storageKey) {
        return res.status(404).end()
      }
      if (meta.status !== 'published' || meta.rightsStatus === 'blocked') {
        return res.status(403).end()
      }
      return void (await streamAudioFileToResponse(
        req,
        res,
        meta.storageKey,
        meta.mime || 'audio/mpeg'
      ))
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyCode/request-control', withRate, async (req, res, next) => {
    try {
      const code = String(req.params.partyCode || '')
      if (!PC.test(code)) {
        return res.status(400).json({ error: 'invalid_party_code' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      await ensurePartyNotExpired({
        getPool: d.getPool,
        io: /** @type {import('socket.io').Server | undefined} */ (req.app.get('io')),
        partyCode: code
      })
      const tok = readGuestTokenFromRequest(req)
      if (!tok) {
        return res.status(401).json({ error: 'no_guest_session' })
      }
      const g = await findGuestByTokenForPartyCode(tok, code, pool)
      if (!g) {
        return res.status(401).json({ error: 'invalid_guest_session' })
      }
      const session = await findSessionByPartyCode(code, pool)
      if (!session) {
        return res.status(404).json({ error: 'party_not_found' })
      }
      if (String(g.session_pk) !== String(session.id)) {
        return res.status(403).json({ error: 'mismatch' })
      }
      if (session.status === 'ended' || session.status === 'disabled') {
        return res.status(403).json({ error: 'not_available' })
      }
      if (session.status !== 'approved' && session.status !== 'active') {
        return res.status(403).json({ error: 'not_available' })
      }
      if (await crRepo.hasPendingControlForGuest(String(session.id), g.id, pool)) {
        return res.status(409).json({ error: 'control_already_pending' })
      }
      const b = /** @type {Record<string, unknown>} */ (req.body) || {}
      const wantSong = b.songId != null && String(b.songId).length > 0 ? String(b.songId) : null
      let songIdToStore = null
      if (wantSong) {
        if (!UUID.test(wantSong)) {
          return res.status(400).json({ error: 'invalid_song_id' })
        }
        if (!(await plRepo.hasSongInSessionPlaylist(String(session.id), wantSong, pool))) {
          return res.status(400).json({ error: 'song_not_in_playlist' })
        }
        songIdToStore = wantSong
      } else {
        const active = /** @type {any} */ (session).active_song_id
        if (active) {
          songIdToStore = String(active)
        } else {
          const playlist = await plRepo.listPlaylistWithSongsForSession(String(session.id), pool)
          const preferred =
            playlist.find((item) => String(item.itemStatus || 'pending') === 'active') ||
            playlist.find((item) => String(item.itemStatus || 'pending') === 'pending') ||
            null
          if (!preferred?.id) {
            return res.status(400).json({ error: 'no_active_song' })
          }
          songIdToStore = String(preferred.id)
        }
      }
      const row = await crRepo.createRequest(
        {
          sessionId: String(session.id),
          partyGuestId: g.id,
          songId: songIdToStore,
          requestKind: 'control'
        },
        pool
      )
      const io = /** @type {import('socket.io').Server | undefined} */ (req.app.get('io'))
      await emitControlAndPartyState(io, d.getPool, String(session.id), 'control:requested', {
        requestId: String(row.id),
        partyGuestId: String(g.id),
        songId: songIdToStore
      })
      return res.status(201).json({
        ok: true,
        request: { id: row.id, songId: songIdToStore }
      })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyCode/leave', withRate, async (req, res, next) => {
    try {
      const code = String(req.params.partyCode || '')
      if (!PC.test(code)) {
        return res.status(400).json({ error: 'invalid_party_code' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const tok = readGuestTokenFromRequest(req)
      if (!tok) {
        clearGuestTokenCookie(res)
        return res.status(401).json({ error: 'no_guest_session' })
      }
      const g = await findGuestByTokenForPartyCode(tok, code, pool)
      if (!g) {
        clearGuestTokenCookie(res)
        return res.status(401).json({ error: 'invalid_guest_session' })
      }
      const session = await findSessionByPartyCode(code, pool)
      if (!session) {
        clearGuestTokenCookie(res)
        return res.status(404).json({ error: 'party_not_found' })
      }
      if (String(g.session_pk) !== String(session.id)) {
        clearGuestTokenCookie(res)
        return res.status(403).json({ error: 'mismatch' })
      }

      await updatePartyGuestConnectionState(String(g.id), { isConnected: false }, pool)
      const wasController =
        String(session.current_controller_party_guest_id || '') === String(g.id)
      if (wasController) {
        await setCurrentControllerGuest(String(session.id), null, pool)
      }
      clearGuestTokenCookie(res)

      const io = /** @type {import('socket.io').Server | undefined} */ (req.app.get('io'))
      if (wasController) {
        await emitControlAndPartyState(io, d.getPool, String(session.id), 'control:revoked', {
          partyGuestId: String(g.id),
          source: 'guest:leave'
        })
      }
      if (io) {
        await emitPartyGuestsUpdated(io, String(session.id), d.getPool)
      }
      return res.json({ ok: true, redirect: '/' })
    } catch (e) {
      return next(e)
    }
  })

  r.get('/:partyCode/playlist', async (req, res, next) => {
    try {
      const code = String(req.params.partyCode || '')
      if (!PC.test(code)) {
        return res.status(400).json({ error: 'invalid_party_code' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      await ensurePartyNotExpired({
        getPool: d.getPool,
        io: /** @type {import('socket.io').Server | undefined} */ (req.app.get('io')),
        partyCode: code
      })
      const s = await findSessionByPartyCode(code, pool)
      if (!s) {
        return res.status(404).json({ error: 'party_not_found' })
      }
      if (s.status === 'ended' || s.status === 'disabled') {
        return res.status(403).json({ error: 'not_available' })
      }
      const playlist = await plRepo.listPlaylistWithSongsForSession(s.id, pool)
      return res.json({
        playlist: playlist.map((p) => ({
          playlistItemId: p.playlistItemId,
          position: p.position,
          status: mapGuestPlaylistStatus(p.itemStatus),
          requestedByGuestId: p.requestedByGuestId ?? null,
          requestedByGuestDisplayName: p.requestedByGuestDisplayName ?? null,
          id: p.id,
          title: p.title,
          difficulty: p.difficulty,
          tags: p.tags,
          audioReady: p.audioReady,
          lyricsReady: p.lyricsReady
        }))
      })
    } catch (e) {
      return next(e)
    }
  })

  r.get('/:partyCode/available-songs', async (req, res, next) => {
    try {
      const code = String(req.params.partyCode || '')
      if (!PC.test(code)) {
        return res.status(400).json({ error: 'invalid_party_code' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      await ensurePartyNotExpired({
        getPool: d.getPool,
        io: /** @type {import('socket.io').Server | undefined} */ (req.app.get('io')),
        partyCode: code
      })
      const tok = readGuestTokenFromRequest(req)
      if (!tok) {
        return res.status(401).json({ error: 'no_guest_session' })
      }
      const g = await findGuestByTokenForPartyCode(tok, code, pool)
      if (!g) {
        return res.status(401).json({ error: 'invalid_guest_session' })
      }
      const s = await findSessionByPartyCode(code, pool)
      if (!s) {
        return res.status(404).json({ error: 'party_not_found' })
      }
      if (String(g.session_pk) !== String(s.id)) {
        return res.status(403).json({ error: 'mismatch' })
      }
      if (s.status === 'ended' || s.status === 'disabled') {
        return res.status(403).json({ error: 'not_available' })
      }
      const songs = await listAvailableSongsForPartyPanel(pool)
      const safeSongs = songs
        .filter((song) => String(song.status || '') === 'published')
        .filter((song) => String(song.rightsStatus || '') !== 'blocked')
      return res.json({
        songs: safeSongs.map((song) => ({
          id: String(song.id),
          title: String(song.title || 'Untitled'),
          difficulty: song.difficulty || null,
          tags: Array.isArray(song.tags) ? song.tags : [],
          audioReady: song.audioReady === true,
          lyricsReady: song.lyricsReady === true
        }))
      })
    } catch (e) {
      return next(e)
    }
  })

  r.get('/:partyCode/songs/:songId/preview', async (req, res, next) => {
    try {
      const code = String(req.params.partyCode || '')
      const songId = String(req.params.songId || '')
      if (!PC.test(code)) {
        return res.status(400).json({ error: 'invalid_party_code' })
      }
      if (!UUID.test(songId)) {
        return res.status(400).json({ error: 'invalid_song_id' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      await ensurePartyNotExpired({
        getPool: d.getPool,
        io: /** @type {import('socket.io').Server | undefined} */ (req.app.get('io')),
        partyCode: code
      })
      const tok = readGuestTokenFromRequest(req)
      if (!tok) {
        return res.status(401).json({ error: 'no_guest_session' })
      }
      const g = await findGuestByTokenForPartyCode(tok, code, pool)
      if (!g) {
        return res.status(401).json({ error: 'invalid_guest_session' })
      }
      const s = await findSessionByPartyCode(code, pool)
      if (!s) {
        return res.status(404).json({ error: 'party_not_found' })
      }
      if (String(g.session_pk) !== String(s.id)) {
        return res.status(403).json({ error: 'mismatch' })
      }
      if (s.status === 'ended' || s.status === 'disabled') {
        return res.status(403).json({ error: 'not_available' })
      }
      const songs = await listAvailableSongsForPartyPanel(pool)
      const song = songs.find((x) => String(x.id) === songId)
      if (!song || String(song.status || '') !== 'published' || String(song.rightsStatus || '') === 'blocked') {
        return res.status(404).json({ error: 'song_not_available' })
      }
      const lines = await listLinesForSong(songId, pool)
      const language = normalizeGuestLanguage(g.language_preference)
      const previewLines = lines.slice(0, 4).map((line) => ({
        lineNumber: Number(line.lineNumber),
        text: pickLineTextForLanguage(line, language) || pickLineTextForLanguage(line, 'english') || ''
      }))
      return res.json({
        song: {
          id: String(song.id),
          title: String(song.title || 'Untitled')
        },
        languagePreference: language,
        previewLines
      })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyCode/request-song', withRate, async (req, res, next) => {
    try {
      const code = String(req.params.partyCode || '')
      if (!PC.test(code)) {
        return res.status(400).json({ error: 'invalid_party_code' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      await ensurePartyNotExpired({
        getPool: d.getPool,
        io: /** @type {import('socket.io').Server | undefined} */ (req.app.get('io')),
        partyCode: code
      })
      const tok = readGuestTokenFromRequest(req)
      if (!tok) {
        return res.status(401).json({ error: 'no_guest_session' })
      }
      const g = await findGuestByTokenForPartyCode(tok, code, pool)
      if (!g) {
        return res.status(401).json({ error: 'invalid_guest_session' })
      }
      const b = /** @type {Record<string, unknown>} */ (req.body) || {}
      const songId = String(b.songId ?? b.song_id ?? '')
      if (!UUID.test(songId)) {
        return res.status(400).json({ error: 'invalid_song_id' })
      }
      const session = await findSessionByPartyCode(code, pool)
      if (!session || (session.status !== 'approved' && session.status !== 'active')) {
        return res.status(403).json({ error: 'not_available' })
      }
      if (String(g.session_pk) !== String(session.id)) {
        return res.status(403).json({ error: 'mismatch' })
      }
      const inList = await plRepo.hasSongInSessionPlaylist(session.id, songId, pool)
      const allowed = await isSongAllowedOnPartyPlaylist(songId, pool)
      if (!allowed) {
        return res.status(400).json({ error: 'song_not_available' })
      }
      if (await crRepo.hasPendingSongRequestForSessionSong(session.id, songId, pool)) {
        return res.status(409).json({ error: 'song_request_already_pending' })
      }
      if (inList || (await crRepo.hasApprovedSongRequestForSessionSong(session.id, songId, pool))) {
        return res.status(409).json({ error: 'song_already_in_playlist' })
      }
      const row = await crRepo.createRequest(
        {
          sessionId: session.id,
          partyGuestId: g.id,
          songId,
          requestKind: 'song'
        },
        pool
      )
      const io = /** @type {import('socket.io').Server | undefined} */ (req.app.get('io'))
      await emitControlAndPartyState(io, d.getPool, String(session.id), 'control:requested', {
        requestId: String(row.id),
        partyGuestId: String(g.id),
        songId
      })
      return res.status(201).json({ request: { id: row.id, songId, status: row.status } })
    } catch (e) {
      return next(e)
    }
  })

  r.get('/:partyCode', async (req, res, next) => {
    try {
      const code = String(req.params.partyCode || '')
      if (!PC.test(code)) {
        return res.status(400).json({ error: 'invalid_party_code' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      await ensurePartyNotExpired({
        getPool: d.getPool,
        io: /** @type {import('socket.io').Server | undefined} */ (req.app.get('io')),
        partyCode: code
      })
      const tok = readGuestTokenFromRequest(req)
      if (!tok) {
        return res.status(401).json({ error: 'no_guest_session' })
      }
      const row = await findGuestByTokenForPartyCode(tok, code, pool)
      if (!row) {
        return res.status(401).json({ error: 'invalid_guest_session' })
      }
      return res.json({
        partyCode: code,
        guest: {
          id: row.id,
          displayName: row.display_name,
          languagePreference: row.language_preference
        },
        session: {
          id: row.session_pk,
          status: row.session_status,
          maxGuests: row.max_guests
        }
      })
    } catch (e) {
      return next(e)
    }
  })

  return r
}
