import { describe, expect, it, vi } from 'vitest'
import { listSongsForBotSelection } from './src/db/repos/songsRepo.mjs'

describe('listSongsForBotSelection (SQL contract)', () => {
  it('excludes non-published, blocked, missing audio url, no lyrics, and items already in playlist', async () => {
    const captured = []
    const sessionId = 'ssssssss-ssss-4sss-8sss-ssssssssssss'
    const pool = {
      query: vi.fn(async (q) => {
        captured.push(String(q))
        return { rows: [] }
      })
    }
    await listSongsForBotSelection(sessionId, pool)
    const sql = captured[0] || ''
    expect(sql).toMatch(/status = 'published'/i)
    expect(sql).toMatch(/rights_status *<>/i)
    expect(sql).toMatch(/audio_file_url IS NOT NULL/i)
    expect(sql).toMatch(/lyric_lines/i)
    expect(sql).toMatch(/party_playlist_items/i)
    expect(sql).toMatch(/\$1::uuid/)
    expect(pool.query.mock.calls[0][1]).toEqual([sessionId])
  })
})
