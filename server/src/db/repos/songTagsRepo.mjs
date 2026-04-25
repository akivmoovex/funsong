import { getDbPool } from './poolContext.mjs'

export async function listTagsForSong(songId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    'SELECT * FROM song_tags WHERE song_id = $1::uuid ORDER BY created_at, id',
    [songId]
  )
  return rows
}

export async function addTag(songId, tag, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    'INSERT INTO song_tags (song_id, tag) VALUES ($1::uuid, btrim($2::text)) RETURNING *',
    [songId, tag]
  )
  return rows[0]
}

export async function removeTagById(id, p) {
  const q = getDbPool(p)
  const { rowCount } = await q.query('DELETE FROM song_tags WHERE id = $1::uuid', [id])
  return rowCount ?? 0
}

/**
 * Replace all tags for a song. Skips empty strings; de-dupes by case-insensitive first occurrence.
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function replaceTagsForSong(songId, tagStrings, p) {
  const list = Array.isArray(tagStrings) ? tagStrings : []
  const seen = new Set()
  const cleaned = []
  for (const raw of list) {
    const t = String(raw).trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    cleaned.push(t)
  }

  const q = getDbPool(p)
  if (typeof q.connect === 'function') {
    const c = await q.connect()
    try {
      await c.query('BEGIN')
      await c.query('DELETE FROM song_tags WHERE song_id = $1::uuid', [songId])
      for (const t of cleaned) {
        await c.query(
          'INSERT INTO song_tags (song_id, tag) VALUES ($1::uuid, btrim($2::text))',
          [songId, t]
        )
      }
      await c.query('COMMIT')
    } catch (e) {
      await c.query('ROLLBACK')
      throw e
    } finally {
      c.release()
    }
  } else {
    await q.query('DELETE FROM song_tags WHERE song_id = $1::uuid', [songId])
    for (const t of cleaned) {
      await q.query(
        'INSERT INTO song_tags (song_id, tag) VALUES ($1::uuid, btrim($2::text))',
        [songId, t]
      )
    }
  }
}
