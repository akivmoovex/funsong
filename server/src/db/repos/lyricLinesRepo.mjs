import { getDbPool } from './poolContext.mjs'

/**
 * @param {import('pg').QueryResultRow} row
 */
export function mapLineRow(row) {
  if (!row) {
    return null
  }
  return {
    id: row.id,
    lineNumber: row.line_number,
    startTimeSeconds: row.start_time_seconds,
    endTimeSeconds: row.end_time_seconds,
    textEnglish: row.text_english,
    textHindi: row.text_hindi,
    textHebrew: row.text_hebrew
  }
}

export async function listLinesForSong(songId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT * FROM lyric_lines WHERE song_id = $1::uuid
     ORDER BY line_number ASC, id`,
    [songId]
  )
  return rows.map((r) => mapLineRow(r))
}

/**
 * Replaces all lines for a song in one transaction.
 * @param {string} songId
 * @param {Array<{
 *   lineNumber: number,
 *   startTimeSeconds?: number | null,
 *   endTimeSeconds?: number | null,
 *   textEnglish?: string,
 *   textHindi?: string,
 *   textHebrew?: string
 * }>} lines
 * @param {import('pg').Pool|import('pg').PoolClient} p
 */
export async function replaceAllLinesForSong(songId, lines, p) {
  const q = getDbPool(p)
  if (typeof q.connect === 'function') {
    const c = await q.connect()
    try {
      await c.query('BEGIN')
      await c.query('DELETE FROM lyric_lines WHERE song_id = $1::uuid', [songId])
      for (const l of lines) {
        const te = String(l.textEnglish ?? '')
        const th = String(l.textHindi ?? '')
        const tHe = String(l.textHebrew ?? '')
        if (!te.trim() && !th.trim() && !tHe.trim()) {
          throw new Error('line_empty_languages')
        }
        await c.query(
          `INSERT INTO lyric_lines (
            song_id, line_number, start_time_seconds, end_time_seconds,
            text_english, text_hindi, text_hebrew
          ) VALUES ($1::uuid, $2::int, $3, $4, btrim($5::text), btrim($6::text), btrim($7::text))`,
          [
            songId,
            l.lineNumber,
            l.startTimeSeconds == null || l.startTimeSeconds === '' ? null : Number(l.startTimeSeconds),
            l.endTimeSeconds == null || l.endTimeSeconds === '' ? null : Number(l.endTimeSeconds),
            te,
            th,
            tHe
          ]
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
    await q.query('DELETE FROM lyric_lines WHERE song_id = $1::uuid', [songId])
    for (const l of lines) {
      const te = String(l.textEnglish ?? '')
      const th = String(l.textHindi ?? '')
      const tHe = String(l.textHebrew ?? '')
      if (!te.trim() && !th.trim() && !tHe.trim()) {
        throw new Error('line_empty_languages')
      }
      await q.query(
        `INSERT INTO lyric_lines (
          song_id, line_number, start_time_seconds, end_time_seconds,
          text_english, text_hindi, text_hebrew
        ) VALUES ($1::uuid, $2::int, $3, $4, btrim($5::text), btrim($6::text), btrim($7::text))`,
        [
          songId,
          l.lineNumber,
          l.startTimeSeconds == null || l.startTimeSeconds === '' ? null : Number(l.startTimeSeconds),
          l.endTimeSeconds == null || l.endTimeSeconds === '' ? null : Number(l.endTimeSeconds),
          te,
          th,
          tHe
        ]
      )
    }
  }
  return listLinesForSong(songId, p)
}
