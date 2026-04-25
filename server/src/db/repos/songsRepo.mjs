import { getDbPool } from './poolContext.mjs'

const TAG_LIST_SQL = `(SELECT coalesce(array_agg(t.tag ORDER BY t.created_at, t.id), array[]::text[]) FROM song_tags t WHERE t.song_id = s.id)`

const BASE_SELECT = `s.*, ${TAG_LIST_SQL} AS tag_list`

/**
 * @param {import('pg').QueryResultRow} row
 */
export function mapSongRow(row) {
  if (!row) return null
  const tagList = row.tag_list
  return {
    id: row.id,
    title: row.title,
    movieName: row.movie_name,
    originalArtist: row.original_artist,
    composer: row.composer,
    lyricist: row.lyricist,
    year: row.year,
    durationMs: row.duration_ms,
    durationSeconds:
      row.duration_ms != null ? Math.floor(Number(row.duration_ms) / 1000) : null,
    difficulty: row.difficulty,
    status: row.status,
    rightsStatus: row.rights_status,
    isDefaultSuggestion: row.is_default_suggestion,
    instrumentalAudioPath: row.instrumental_audio_path,
    /** App path for session-authenticated streaming, e.g. /api/songs/{id}/audio */
    audioFileUrl: row.audio_file_url,
    audioMimeType: row.audio_mime_type,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: Array.isArray(tagList) ? tagList : []
  }
}

export async function findSongById(id, p) {
  const q = getDbPool(p)
  const { rows: out } = await q.query(
    `SELECT ${BASE_SELECT} FROM songs s WHERE s.id = $1::uuid`,
    [id]
  )
  return mapSongRow(out[0]) || null
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function listSongs(p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT ${BASE_SELECT} FROM songs s ORDER BY s.updated_at DESC NULLS LAST, s.title`
  )
  return rows.map((r) => mapSongRow(r))
}

/**
 * Only published + not blocked; used for host party playlists and guest flows.
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function listSongsForPartySelection(p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT ${BASE_SELECT} FROM songs s
     WHERE s.status = 'published'::song_status
       AND s.rights_status <> 'blocked'::rights_status
     ORDER BY s.is_default_suggestion DESC NULLS LAST, s.title ASC NULLS LAST`
  )
  return rows.map((r) => mapSongRow(r))
}

/**
 * Suggested songs for host playlist (defaults only).
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function listDefaultSuggestionSongs(p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT ${BASE_SELECT},
       (s.audio_file_url IS NOT NULL OR s.instrumental_audio_path IS NOT NULL) AS audio_ok,
       EXISTS(SELECT 1 FROM lyric_lines ll WHERE ll.song_id = s.id LIMIT 1) AS lyrics_ok
     FROM songs s
     WHERE s.status = 'published'::song_status
       AND s.rights_status <> 'blocked'::rights_status
       AND s.is_default_suggestion = true
     ORDER BY s.title ASC NULLS LAST`
  )
  return rows.map((r) => ({
    ...mapSongRow(r),
    audioReady: r.audio_ok === true,
    lyricsReady: r.lyrics_ok === true
  }))
}

/**
 * Eligible for host bot: published, not blocked, in-app MP3 URL, has lyrics, not in this session queue.
 * @param {string} sessionId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function listSongsForBotSelection(sessionId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT ${BASE_SELECT}
     FROM songs s
     WHERE s.status = 'published'::song_status
       AND s.rights_status <> 'blocked'::rights_status
       AND s.audio_file_url IS NOT NULL
       AND btrim(s.audio_file_url) <> ''
       AND EXISTS(SELECT 1 FROM lyric_lines ll WHERE ll.song_id = s.id LIMIT 1)
       AND s.id NOT IN (
         SELECT ppi.song_id FROM party_playlist_items ppi
         WHERE ppi.session_id = $1::uuid
       )`,
    [sessionId]
  )
  return rows.map((r) => mapSongRow(r))
}

/**
 * Song may be added to a party playlist (published, not blocked).
 * @param {string} songId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 * @returns {Promise<boolean>}
 */
export async function isSongAllowedOnPartyPlaylist(songId, p) {
  const r = await findSongById(songId, p)
  if (!r) return false
  if (r.status !== 'published') return false
  if (r.rightsStatus === 'blocked') return false
  return true
}

/**
 * @param {object} o
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function createSong(o, p) {
  const q = getDbPool(p)
  const durationMs = durationToMsFromInput(o)

  const { rows: out } = await q.query(
    `INSERT INTO songs (
        title, status, rights_status, instrumental_audio_path, duration_ms, created_by,
        movie_name, original_artist, composer, lyricist, year, difficulty, is_default_suggestion
     ) VALUES (
        btrim($1::text),
        COALESCE($2::song_status, 'draft'),
        COALESCE($3::rights_status, 'private_instrumental'),
        $4, $5, $6::uuid,
        $7, $8, $9, $10, $11, $12, COALESCE($13, false)
     )
     RETURNING id`,
    [
      o.title,
      o.status ?? null,
      o.rightsStatus ?? null,
      o.instrumentalAudioPath ?? null,
      durationMs,
      o.createdBy ?? null,
      o.movieName ?? null,
      o.originalArtist ?? null,
      o.composer ?? null,
      o.lyricist ?? null,
      o.year ?? null,
      o.difficulty ?? null,
      o.isDefaultSuggestion
    ]
  )
  if (!out[0]) {
    return null
  }
  return findSongById(out[0].id, p)
}

function durationToMsFromInput(o) {
  if (o.durationMs != null) return o.durationMs
  if (o.durationSeconds == null) return null
  const s = Math.max(0, Math.floor(Number(o.durationSeconds)))
  return s * 1000
}

/**
 * Full update (all columns). Caller must merge with existing first.
 * @param {import('pg').QueryResultRow} f — camelCase fields
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function updateSongFields(id, f, p) {
  const q = getDbPool(p)
  const { rows: out } = await q.query(
    `UPDATE songs SET
        title = btrim($1::text),
        status = $2::song_status,
        rights_status = $3::rights_status,
        instrumental_audio_path = $4,
        duration_ms = $5,
        movie_name = $6,
        original_artist = $7,
        composer = $8,
        lyricist = $9,
        year = $10,
        difficulty = $11,
        is_default_suggestion = $12
     WHERE id = $13::uuid
     RETURNING id`,
    [
      f.title,
      f.status,
      f.rightsStatus,
      f.instrumentalAudioPath,
      f.durationMs,
      f.movieName,
      f.originalArtist,
      f.composer,
      f.lyricist,
      f.year,
      f.difficulty,
      f.isDefaultSuggestion,
      id
    ]
  )
  if (!out[0]) {
    return null
  }
  return findSongById(id, p)
}

/**
 * @param {'published' | 'disabled'} status
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function setSongStatus(songId, status, p) {
  if (status !== 'published' && status !== 'disabled') {
    throw new Error('invalid_status')
  }
  const q = getDbPool(p)
  const { rows: out } = await q.query(
    `UPDATE songs
      SET status = $2::song_status, updated_at = now()
     WHERE id = $1::uuid
     RETURNING id`,
    [songId, status]
  )
  if (!out[0]) {
    return null
  }
  return findSongById(songId, p)
}

/**
 * For authenticated audio stream (no key in public JSON).
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function getSongStreamMeta(songId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT id, status, rights_status, audio_storage_key, audio_mime_type
     FROM songs WHERE id = $1::uuid`,
    [songId]
  )
  const r = rows[0]
  if (!r) {
    return null
  }
  return {
    id: r.id,
    status: r.status,
    rightsStatus: r.rights_status,
    storageKey: r.audio_storage_key,
    mime: r.audio_mime_type
  }
}

/**
 * @param {object} o
 * @param {string} o.audioFileUrl
 * @param {string} o.audioStorageKey
 * @param {string} o.audioMimeType
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function setSongAudioFields(songId, o, p) {
  const q = getDbPool(p)
  const { rows: out } = await q.query(
    `UPDATE songs
      SET audio_file_url = $1,
          audio_storage_key = $2,
          audio_mime_type = $3,
          updated_at = now()
     WHERE id = $4::uuid
     RETURNING id`,
    [o.audioFileUrl, o.audioStorageKey, o.audioMimeType, songId]
  )
  if (!out[0]) {
    return null
  }
  return findSongById(songId, p)
}
