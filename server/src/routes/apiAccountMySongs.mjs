import express from 'express'
import { listLinesForSong } from '../db/repos/lyricLinesRepo.mjs'
import { findSongById } from '../db/repos/songsRepo.mjs'
import {
  addFavoriteSong,
  isFavoriteSong,
  listFavoriteSongs,
  removeFavoriteSong
} from '../services/userFavoritesService.mjs'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {{ getPool: () => import('pg').Pool | null }} d
 */
export function createAccountMySongsRouter(d) {
  const r = express.Router()

  r.get('/', async (req, res) => {
    const pool = d.getPool()
    if (!pool) return res.status(503).json({ error: 'no_database' })
    const user = /** @type {{ id: string }} */ (req.funsongUser)
    const songs = await listFavoriteSongs(user.id, pool)
    return res.json({ songs })
  })

  r.post('/:songId', async (req, res) => {
    if (!UUID_RE.test(req.params.songId)) {
      return res.status(400).json({ error: 'invalid_song_id' })
    }
    const pool = d.getPool()
    if (!pool) return res.status(503).json({ error: 'no_database' })
    const user = /** @type {{ id: string }} */ (req.funsongUser)
    const song = await findSongById(req.params.songId, pool)
    if (!song) {
      return res.status(404).json({ error: 'song_not_found' })
    }
    const added = await addFavoriteSong(user.id, req.params.songId, pool)
    return res.status(added ? 201 : 200).json({ ok: true, added: !!added })
  })

  r.delete('/:songId', async (req, res) => {
    if (!UUID_RE.test(req.params.songId)) {
      return res.status(400).json({ error: 'invalid_song_id' })
    }
    const pool = d.getPool()
    if (!pool) return res.status(503).json({ error: 'no_database' })
    const user = /** @type {{ id: string }} */ (req.funsongUser)
    const removed = await removeFavoriteSong(user.id, req.params.songId, pool)
    return res.json({ ok: true, removed })
  })

  r.get('/:songId/practice', async (req, res) => {
    if (!UUID_RE.test(req.params.songId)) {
      return res.status(400).json({ error: 'invalid_song_id' })
    }
    const pool = d.getPool()
    if (!pool) return res.status(503).json({ error: 'no_database' })
    const user = /** @type {{ id: string }} */ (req.funsongUser)
    const fav = await isFavoriteSong(user.id, req.params.songId, pool)
    if (!fav) {
      return res.status(403).json({ error: 'not_favorite' })
    }
    const song = await findSongById(req.params.songId, pool)
    if (!song) {
      return res.status(404).json({ error: 'song_not_found' })
    }
    const lines = await listLinesForSong(req.params.songId, pool)
    return res.json({
      song: {
        id: song.id,
        title: song.title,
        difficulty: song.difficulty,
        tags: song.tags || [],
        audioReady: !!song.audioFileUrl,
        lyricsReady: lines.length > 0,
        audioFileUrl: song.audioFileUrl || null
      },
      lines
    })
  })

  return r
}
