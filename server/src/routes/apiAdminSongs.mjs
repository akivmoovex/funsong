import { Router } from 'express'
import { writeFile, unlink } from 'node:fs/promises'
import { getPool } from '../db/pool.mjs'
import { absolutePathForStorageKey, ensureDir, pathsForNewUpload } from '../audio/paths.mjs'
import { isLikelyMp3Buffer } from '../audio/mp3.mjs'
import { getAudioUpload, sendMulterError } from '../middleware/uploadAudio.mjs'
import * as songsRepo from '../db/repos/songsRepo.mjs'
import * as lyricLinesRepo from '../db/repos/lyricLinesRepo.mjs'
import { replaceTagsForSong } from '../db/repos/songTagsRepo.mjs'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const SONG_STATUS = new Set(['draft', 'published', 'disabled'])
const RIGHTS = new Set([
  'private_instrumental',
  'owned_by_app',
  'permission_pending',
  'licensed',
  'blocked'
])
const DIFF = new Set(['easy', 'medium', 'hard', 'expert'])

/**
 * @param {import('express').Request} req
 */
function poolFrom(req) {
  const g = /** @type {() => import('pg').Pool | null} | undefined} */ (
    req.app.get('getPool')
  )
  if (typeof g === 'function') return g()
  return getPool()
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function noDb(res) {
  return res.status(503).json({ error: 'no_database' })
}

/**
 * @param {object} body
 * @param {import('../db/repos/songsRepo.mjs').mapSongRow extends Function ? any : any} cur
 */
function mergeUpdate(body, cur) {
  const p = (/** @type {any} */ (b, k) => (b[k] !== undefined ? b[k] : cur[k]))
  let durationMs = cur.durationMs
  if (Object.prototype.hasOwnProperty.call(body, 'durationSeconds')) {
    if (body.durationSeconds == null || body.durationSeconds === '') {
      durationMs = null
    } else {
      const s = Math.max(0, Math.floor(Number(body.durationSeconds)))
      durationMs = s * 1000
    }
  } else if (Object.prototype.hasOwnProperty.call(body, 'durationMs')) {
    durationMs = body.durationMs
  }
  let year = cur.year
  if (Object.prototype.hasOwnProperty.call(body, 'year')) {
    if (body.year == null || body.year === '') {
      year = null
    } else {
      year = Math.floor(Number(body.year))
    }
  }
  let difficulty = cur.difficulty
  if (Object.prototype.hasOwnProperty.call(body, 'difficulty')) {
    difficulty = body.difficulty || null
  }
  return {
    title: body.title !== undefined ? String(body.title) : cur.title,
    status: p(body, 'status') ?? cur.status,
    rightsStatus: p(body, 'rightsStatus') ?? cur.rightsStatus,
    instrumentalAudioPath:
      body.instrumentalAudioPath === undefined
        ? cur.instrumentalAudioPath
        : body.instrumentalAudioPath,
    durationMs,
    movieName: body.movieName === undefined ? cur.movieName : body.movieName,
    originalArtist:
      body.originalArtist === undefined ? cur.originalArtist : body.originalArtist,
    composer: body.composer === undefined ? cur.composer : body.composer,
    lyricist: body.lyricist === undefined ? cur.lyricist : body.lyricist,
    year,
    difficulty,
    isDefaultSuggestion:
      body.isDefaultSuggestion === undefined
        ? cur.isDefaultSuggestion
        : Boolean(body.isDefaultSuggestion)
  }
}

/**
 * @param {object} merged
 * @param {import('express').Response} res
 * @returns {boolean} ok
 */
function validateSongPayload(merged, res, requireTitle) {
  if (requireTitle && (!merged.title || !String(merged.title).trim())) {
    res.status(400).json({ error: 'title_required' })
    return false
  }
  if (merged.status && !SONG_STATUS.has(merged.status)) {
    res.status(400).json({ error: 'invalid_status' })
    return false
  }
  if (merged.rightsStatus && !RIGHTS.has(merged.rightsStatus)) {
    res.status(400).json({ error: 'invalid_rights_status' })
    return false
  }
  if (merged.difficulty && !DIFF.has(merged.difficulty)) {
    res.status(400).json({ error: 'invalid_difficulty' })
    return false
  }
  if (merged.year != null && (merged.year < 1000 || merged.year > 3000)) {
    res.status(400).json({ error: 'invalid_year' })
    return false
  }
  if (merged.durationMs != null && merged.durationMs < 0) {
    res.status(400).json({ error: 'invalid_duration' })
    return false
  }
  return true
}

/**
 * @param {unknown} lines
 * @returns {string | null} error code
 */
function validateLyricBody(lines) {
  if (!Array.isArray(lines)) {
    return 'lines_array'
  }
  const seen = new Set()
  for (const raw of lines) {
    if (!raw || typeof raw !== 'object') {
      return 'line_shape'
    }
    const l = /** @type {any} */ (raw)
    const n = l.lineNumber
    if (n == null || !Number.isInteger(n) || n < 0) {
      return 'line_number'
    }
    if (seen.has(n)) {
      return 'duplicate_line_number'
    }
    seen.add(n)
    if (
      l.startTimeSeconds != null &&
      l.startTimeSeconds !== '' &&
      !Number.isFinite(Number(l.startTimeSeconds))
    ) {
      return 'time_invalid'
    }
    if (
      l.endTimeSeconds != null &&
      l.endTimeSeconds !== '' &&
      !Number.isFinite(Number(l.endTimeSeconds))
    ) {
      return 'time_invalid'
    }
    const te = String(l.textEnglish ?? '')
    const th = String(l.textHindi ?? '')
    const tHe = String(l.textHebrew ?? '')
    if (!te.trim() && !th.trim() && !tHe.trim()) {
      return 'line_empty_languages'
    }
  }
  return null
}

export function createAdminSongsRouter() {
  const r = Router()

  r.get('/', async (req, res, next) => {
    try {
      const pool = poolFrom(req)
      if (!pool) return noDb(res)
      const out = await songsRepo.listSongs(pool)
      return res.json({ songs: out })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/', async (req, res, next) => {
    try {
      const pool = poolFrom(req)
      if (!pool) return noDb(res)
      const b = /** @type {Record<string, unknown>} */ (req.body) || {}
      if (!b.title || !String(b.title).trim()) {
        return res.status(400).json({ error: 'title_required' })
      }
      const u = /** @type {{ id?: string } | undefined} */ (req.funsongUser)
      if (b.status && !SONG_STATUS.has(/** @type {string} */ (b.status))) {
        return res.status(400).json({ error: 'invalid_status' })
      }
      if (b.rightsStatus && !RIGHTS.has(/** @type {string} */ (b.rightsStatus))) {
        return res.status(400).json({ error: 'invalid_rights_status' })
      }
      if (b.difficulty && !DIFF.has(/** @type {string} */ (b.difficulty))) {
        return res.status(400).json({ error: 'invalid_difficulty' })
      }
      let y = b.year
      if (y === '' || y == null) {
        y = null
      } else {
        y = Math.floor(Number(y))
        if (!Number.isFinite(y)) {
          return res.status(400).json({ error: 'invalid_year' })
        }
      }
      let durationForCheck = b.durationMs
      if (Object.prototype.hasOwnProperty.call(b, 'durationSeconds')) {
        if (b.durationSeconds == null || b.durationSeconds === '') {
          durationForCheck = null
        } else {
          durationForCheck = Math.max(0, Math.floor(Number(b.durationSeconds)) * 1000)
        }
      }
      if (
        !validateSongPayload(
          {
            title: String(b.title).trim(),
            status: /** @type {any} */ (b.status) || 'draft',
            rightsStatus: /** @type {any} */ (b.rightsStatus) || 'private_instrumental',
            durationMs: /** @type {any} */ (durationForCheck),
            year: /** @type {any} */ (y),
            difficulty: b.difficulty || null
          },
          res,
          true
        )
      ) {
        return
      }
      const created = await songsRepo.createSong(
        {
          title: String(b.title).trim(),
          status: b.status,
          rightsStatus: b.rightsStatus,
          instrumentalAudioPath: b.instrumentalAudioPath,
          durationMs: b.durationMs,
          durationSeconds: b.durationSeconds,
          movieName: b.movieName,
          originalArtist: b.originalArtist,
          composer: b.composer,
          lyricist: b.lyricist,
          year: y,
          difficulty: b.difficulty,
          isDefaultSuggestion: b.isDefaultSuggestion,
          createdBy: u?.id
        },
        pool
      )
      if (!created) {
        return res.status(500).json({ error: 'create_failed' })
      }
      if (Array.isArray(b.tags)) {
        await replaceTagsForSong(created.id, b.tags, pool)
        const re = await songsRepo.findSongById(created.id, pool)
        return res.status(201).json({ song: re })
      }
      return res.status(201).json({ song: created })
    } catch (e) {
      return next(e)
    }
  })

  r.get('/:songId', async (req, res, next) => {
    try {
      if (!UUID_RE.test(req.params.songId)) {
        return res.status(400).json({ error: 'invalid_song_id' })
      }
      const pool = poolFrom(req)
      if (!pool) return noDb(res)
      const row = await songsRepo.findSongById(req.params.songId, pool)
      if (!row) {
        return res.status(404).json({ error: 'not_found' })
      }
      return res.json({ song: row })
    } catch (e) {
      return next(e)
    }
  })

  r.get('/:songId/lyrics', async (req, res, next) => {
    try {
      if (!UUID_RE.test(req.params.songId)) {
        return res.status(400).json({ error: 'invalid_song_id' })
      }
      const pool = poolFrom(req)
      if (!pool) {
        return noDb(res)
      }
      const song = await songsRepo.findSongById(req.params.songId, pool)
      if (!song) {
        return res.status(404).json({ error: 'not_found' })
      }
      const lines = await lyricLinesRepo.listLinesForSong(req.params.songId, pool)
      return res.json({ lines, song: { id: song.id, title: song.title } })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:songId/lyrics', async (req, res, next) => {
    try {
      if (!UUID_RE.test(req.params.songId)) {
        return res.status(400).json({ error: 'invalid_song_id' })
      }
      const pool = poolFrom(req)
      if (!pool) {
        return noDb(res)
      }
      const song = await songsRepo.findSongById(req.params.songId, pool)
      if (!song) {
        return res.status(404).json({ error: 'not_found' })
      }
      const b = /** @type {{ lines?: unknown }} */ (req.body) || {}
      if (!Array.isArray(b.lines)) {
        return res.status(400).json({ error: 'lines_required' })
      }
      const err = validateLyricBody(b.lines)
      if (err) {
        return res.status(400).json({ error: err })
      }
      const out = b.lines.map((l) => ({
        lineNumber: l.lineNumber,
        startTimeSeconds: l.startTimeSeconds,
        endTimeSeconds: l.endTimeSeconds,
        textEnglish: l.textEnglish,
        textHindi: l.textHindi,
        textHebrew: l.textHebrew
      }))
      try {
        const lines = await lyricLinesRepo.replaceAllLinesForSong(
          req.params.songId,
          out,
          pool
        )
        return res.json({ lines, song: { id: song.id, title: song.title } })
      } catch (e) {
        if (e instanceof Error && e.message === 'line_empty_languages') {
          return res.status(400).json({ error: 'line_empty_languages' })
        }
        if (e && /** @type {any} */ (e).code === '23505') {
          return res.status(400).json({ error: 'duplicate_line_number' })
        }
        throw e
      }
    } catch (e) {
      return next(e)
    }
  })

  r.post(
    '/:songId/audio',
    (req, res, next) => {
      if (!UUID_RE.test(req.params.songId)) {
        return res.status(400).json({ error: 'invalid_song_id' })
      }
      return getAudioUpload().single('file')(req, res, (err) => {
        if (err) {
          if (sendMulterError(err, res)) {
            return
          }
          return next(err)
        }
        return next()
      })
    },
    async (req, res, next) => {
      try {
        const pool = poolFrom(req)
        if (!pool) {
          return noDb(res)
        }
        if (!req.file) {
          return res.status(400).json({ error: 'file_required' })
        }
        const { songId } = req.params
        const b = /** @type {Buffer} */ (req.file.buffer)
        if (!isLikelyMp3Buffer(b)) {
          return res.status(400).json({ error: 'invalid_audio_type' })
        }
        const existing = await songsRepo.findSongById(songId, pool)
        if (!existing) {
          return res.status(404).json({ error: 'not_found' })
        }
        const prev = await songsRepo.getSongStreamMeta(songId, pool)
        const { storageKey, dir, absPath } = await pathsForNewUpload(songId)
        await ensureDir(dir)
        await writeFile(absPath, b, { mode: 0o640 })
        if (prev?.storageKey) {
          try {
            const oldAbs = absolutePathForStorageKey(prev.storageKey)
            await unlink(oldAbs)
          } catch {
            // ignore missing old file
          }
        }
        const audioFileUrl = `/api/songs/${songId}/audio`
        const updated = await songsRepo.setSongAudioFields(
          songId,
          {
            audioFileUrl,
            audioStorageKey: storageKey,
            audioMimeType: 'audio/mpeg'
          },
          pool
        )
        if (!updated) {
          return res.status(500).json({ error: 'update_failed' })
        }
        return res.status(201).json({ song: updated })
      } catch (e) {
        if (e instanceof Error && e.message === 'invalid_song_id') {
          return res.status(400).json({ error: 'invalid_song_id' })
        }
        if (e instanceof Error && e.message === 'invalid_storage_key') {
          return res.status(500).json({ error: 'storage' })
        }
        return next(e)
      }
    }
  )

  r.post('/:songId/publish', async (req, res, next) => {
    try {
      if (!UUID_RE.test(req.params.songId)) {
        return res.status(400).json({ error: 'invalid_song_id' })
      }
      const pool = poolFrom(req)
      if (!pool) return noDb(res)
      const out = await songsRepo.setSongStatus(req.params.songId, 'published', pool)
      if (!out) {
        return res.status(404).json({ error: 'not_found' })
      }
      return res.json({ song: out })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:songId/disable', async (req, res, next) => {
    try {
      if (!UUID_RE.test(req.params.songId)) {
        return res.status(400).json({ error: 'invalid_song_id' })
      }
      const pool = poolFrom(req)
      if (!pool) return noDb(res)
      const out = await songsRepo.setSongStatus(req.params.songId, 'disabled', pool)
      if (!out) {
        return res.status(404).json({ error: 'not_found' })
      }
      return res.json({ song: out })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:songId', async (req, res, next) => {
    try {
      if (!UUID_RE.test(req.params.songId)) {
        return res.status(400).json({ error: 'invalid_song_id' })
      }
      const pool = poolFrom(req)
      if (!pool) return noDb(res)
      const cur = await songsRepo.findSongById(req.params.songId, pool)
      if (!cur) {
        return res.status(404).json({ error: 'not_found' })
      }
      const b = /** @type {Record<string, unknown>} */ (req.body) || {}
      const merged = mergeUpdate(b, cur)
      if (!validateSongPayload(merged, res, true)) {
        return
      }
      const updated = await songsRepo.updateSongFields(req.params.songId, merged, pool)
      if (!updated) {
        return res.status(404).json({ error: 'not_found' })
      }
      if (Object.prototype.hasOwnProperty.call(b, 'tags') && Array.isArray(b.tags)) {
        await replaceTagsForSong(req.params.songId, b.tags, pool)
        const re = await songsRepo.findSongById(req.params.songId, pool)
        return res.json({ song: re })
      }
      return res.json({ song: updated })
    } catch (e) {
      return next(e)
    }
  })

  return r
}
