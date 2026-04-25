import { getDbPool } from './poolContext.mjs'
import { mapSongRow } from './songsRepo.mjs'

const TAG_LIST_SQL = `(SELECT coalesce(array_agg(t.tag ORDER BY t.created_at, t.id), array[]::text[]) FROM song_tags t WHERE t.song_id = s.id)`

/**
 * @param {string} userId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function listFavoriteSongs(userId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT s.*, ${TAG_LIST_SQL} AS tag_list,
            (s.audio_file_url IS NOT NULL OR s.instrumental_audio_path IS NOT NULL) AS audio_ok,
            EXISTS(SELECT 1 FROM lyric_lines ll WHERE ll.song_id = s.id LIMIT 1) AS lyrics_ok
       FROM user_favorite_songs f
       JOIN songs s ON s.id = f.song_id
      WHERE f.user_id = $1::uuid
      ORDER BY f.created_at DESC`,
    [userId]
  )
  return rows.map((r) => ({
    ...mapSongRow(r),
    audioReady: r.audio_ok === true,
    lyricsReady: r.lyrics_ok === true
  }))
}

/**
 * @param {string} userId
 * @param {string} songId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function addFavoriteSong(userId, songId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `INSERT INTO user_favorite_songs (user_id, song_id)
     VALUES ($1::uuid, $2::uuid)
     ON CONFLICT (user_id, song_id) DO NOTHING
     RETURNING user_id, song_id, created_at`,
    [userId, songId]
  )
  return rows[0] || null
}

/**
 * @param {string} userId
 * @param {string} songId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function removeFavoriteSong(userId, songId, p) {
  const q = getDbPool(p)
  const { rowCount } = await q.query(
    `DELETE FROM user_favorite_songs
      WHERE user_id = $1::uuid
        AND song_id = $2::uuid`,
    [userId, songId]
  )
  return rowCount > 0
}

/**
 * @param {string} userId
 * @param {string} songId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function isFavoriteSong(userId, songId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT 1
       FROM user_favorite_songs
      WHERE user_id = $1::uuid
        AND song_id = $2::uuid
      LIMIT 1`,
    [userId, songId]
  )
  return !!rows[0]
}
