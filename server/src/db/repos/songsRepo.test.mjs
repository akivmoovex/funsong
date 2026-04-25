import { describe, expect, it, vi } from 'vitest'
import { createSong, findSongById, listSongsForPartySelection } from './songsRepo.mjs'

const songId = 'c3c3c3c3-c3c3-43c3-83c3-cccccccccccc'

const row = {
  id: songId,
  title: 'T',
  movie_name: 'M',
  original_artist: 'A',
  composer: 'C',
  lyricist: 'L',
  year: 2020,
  duration_ms: 60_000,
  difficulty: 'easy',
  status: 'draft',
  rights_status: 'licensed',
  is_default_suggestion: false,
  instrumental_audio_path: null,
  created_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  tag_list: ['bollywood']
}

describe('songsRepo', () => {
  it('findSongById queries with tag subselect', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [row] }) }
    const r = await findSongById(songId, pool)
    expect(r?.title).toBe('T')
    const sql = String(pool.query.mock.calls[0][0])
    expect(sql).toMatch(/FROM songs s/i)
    expect(sql).toMatch(/tag_list|song_tags/i)
  })

  it('createSong uses INSERT and reloads with tags', async () => {
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: songId }] })
        .mockResolvedValueOnce({ rows: [row] })
    }
    const r = await createSong({ title: ' Song ' }, pool)
    expect(r?.id).toBe(songId)
    expect(String(pool.query.mock.calls[0][0]).toLowerCase()).toMatch(
      /insert into songs/
    )
  })

  it('listSongsForPartySelection enforces published and not blocked', async () => {
    const q = vi.fn().mockResolvedValue({ rows: [] })
    const pool = { query: q }
    await listSongsForPartySelection(pool)
    const sql = String(q.mock.calls[0][0].toLowerCase())
    expect(sql).toMatch(/status\s*=\s*'published'|published/ )
    expect(sql).toMatch(/blocked/)
  })
})
