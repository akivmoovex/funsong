import { getDbPool } from './poolContext.mjs'
import { mapSongRow } from './songsRepo.mjs'

const TAG_LIST_SQL = `(SELECT coalesce(array_agg(t.tag ORDER BY t.created_at, t.id), array[]::text[]) FROM song_tags t WHERE t.song_id = s.id)`

const PLAYLIST_SONG_SELECT = `ppi.id AS playlist_item_id,
  ppi.position,
  s.*, ${TAG_LIST_SQL} AS tag_list,
  (s.audio_file_url IS NOT NULL OR s.instrumental_audio_path IS NOT NULL) AS audio_ok,
  EXISTS(SELECT 1 FROM lyric_lines ll WHERE ll.song_id = s.id LIMIT 1) AS lyrics_ok`

export async function listPlaylistBySessionId(sessionId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    'SELECT * FROM party_playlist_items WHERE session_id = $1::uuid ORDER BY position, id',
    [sessionId]
  )
  return rows
}

/**
 * @param {string} sessionId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function listPlaylistWithSongsForSession(sessionId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT ${PLAYLIST_SONG_SELECT}
     FROM party_playlist_items ppi
     INNER JOIN songs s ON s.id = ppi.song_id
     WHERE ppi.session_id = $1::uuid
     ORDER BY ppi.position ASC, ppi.id`,
    [sessionId]
  )
  return rows.map((row) => mapPlaylistItemRow(row))
}

function mapPlaylistItemRow(row) {
  const base = mapSongRow(row)
  if (!base) return null
  return {
    playlistItemId: row.playlist_item_id,
    position: row.position,
    itemStatus: row.item_status ?? 'pending',
    ...base,
    audioReady: row.audio_ok === true,
    lyricsReady: row.lyrics_ok === true
  }
}

export async function findPlaylistItemById(id, p) {
  const q = getDbPool(p)
  const { rows } = await q.query('SELECT * FROM party_playlist_items WHERE id = $1::uuid', [id])
  return rows[0] || null
}

/**
 * @param {string} sessionId
 * @param {string} songId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function hasSongInSessionPlaylist(sessionId, songId, p) {
  const q = getDbPool(p)
  const { rowCount } = await q.query(
    'SELECT 1 FROM party_playlist_items WHERE session_id = $1::uuid AND song_id = $2::uuid',
    [sessionId, songId]
  )
  return rowCount > 0
}

/**
 * @param {string} sessionId
 * @param {import('pg').Pool|import('pg').PoolClient} c
 * @returns {Promise<number>} next index at end
 */
export async function nextPositionAtEnd(sessionId, c) {
  const { rows } = await c.query(
    `SELECT coalesce(max(position), -1) + 1 AS n
     FROM party_playlist_items WHERE session_id = $1::uuid`,
    [sessionId]
  )
  return Math.max(0, Number(rows[0]?.n ?? 0))
}

/**
 * @param {object} o
 * @param {string} o.sessionId
 * @param {string} o.songId
 * @param {number} o.position
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function addSongAtPosition(o, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `INSERT INTO party_playlist_items (session_id, song_id, position)
     VALUES ($1::uuid, $2::uuid, $3::int)
     RETURNING *`,
    [o.sessionId, o.songId, o.position]
  )
  return rows[0]
}

/**
 * @param {string} id
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function deleteItemById(id, p) {
  const q = getDbPool(p)
  const { rowCount } = await q.query('DELETE FROM party_playlist_items WHERE id = $1::uuid', [id])
  return rowCount > 0
}

/**
 * @param {string} sessionId
 * @param {string} itemId
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function deleteItemForSession(sessionId, itemId, p) {
  const q = getDbPool(p)
  const { rowCount } = await q.query(
    'DELETE FROM party_playlist_items WHERE id = $1::uuid AND session_id = $2::uuid',
    [itemId, sessionId]
  )
  return rowCount > 0
}

/**
 * @param {string} sessionId
 * @param {import('pg').Pool|import('pg').PoolClient} c
 */
/**
 * Set every row in the session to pending, then mark one item active (start karaoke).
 * @param {string} sessionId
 * @param {string} activeItemId
 * @param {import('pg').Pool | import('pg').PoolClient} c
 */
export async function setPlaylistItemsForStart(sessionId, activeItemId, c) {
  await c.query(
    `UPDATE party_playlist_items
     SET item_status = 'pending'::party_playlist_item_status, updated_at = now()
     WHERE session_id = $1::uuid`,
    [sessionId]
  )
  const { rowCount } = await c.query(
    `UPDATE party_playlist_items
     SET item_status = 'active'::party_playlist_item_status, updated_at = now()
     WHERE id = $1::uuid AND session_id = $2::uuid`,
    [activeItemId, sessionId]
  )
  return rowCount > 0
}

/**
 * @param {string} id
 * @param {import('pg').Pool | import('pg').PoolClient} c
 * @param {'finished'} status
 */
export async function setPlaylistItemStatus(id, status, c) {
  const { rows } = await c.query(
    `UPDATE party_playlist_items
     SET item_status = $2::party_playlist_item_status, updated_at = now()
     WHERE id = $1::uuid
     RETURNING *`,
    [id, status]
  )
  return rows[0] || null
}

export async function compactPositions(sessionId, c) {
  const { rows } = await c.query(
    'SELECT id FROM party_playlist_items WHERE session_id = $1::uuid ORDER BY position, id',
    [sessionId]
  )
  let i = 0
  for (const r of rows) {
    await c.query('UPDATE party_playlist_items SET position = $2 WHERE id = $1::uuid', [r.id, i])
    i += 1
  }
}

/**
 * @param {string} sessionId
 * @param {string[]} orderedItemIds
 * @param {import('pg').Pool|import('pg').PoolClient} c
 * @returns {Promise<boolean>} false if id set does not match session
 */
export async function reorderByItemIds(sessionId, orderedItemIds, c) {
  const { rows: existing } = await c.query(
    'SELECT id::text AS id FROM party_playlist_items WHERE session_id = $1::uuid ORDER BY position, id',
    [sessionId]
  )
  const ex = existing.map((r) => r.id).sort()
  const want = [...orderedItemIds].map(String).sort()
  if (ex.length !== want.length || ex.some((id, idx) => id !== want[idx])) {
    return false
  }
  for (let i = 0; i < orderedItemIds.length; i++) {
    await c.query('UPDATE party_playlist_items SET position = $2 WHERE id = $1::uuid AND session_id = $3::uuid', [
      orderedItemIds[i],
      i,
      sessionId
    ])
  }
  return true
}
