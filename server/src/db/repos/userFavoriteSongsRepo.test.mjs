import { describe, expect, it, vi } from 'vitest'
import {
  addFavoriteSong,
  listFavoriteSongs,
  removeFavoriteSong
} from './userFavoriteSongsRepo.mjs'

describe('userFavoriteSongsRepo', () => {
  it('addFavoriteSong inserts once and duplicate does not duplicate', async () => {
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              song_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              created_at: new Date().toISOString()
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [] })
    }
    const first = await addFavoriteSong(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      pool
    )
    const dup = await addFavoriteSong(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      pool
    )
    expect(first).toBeTruthy()
    expect(dup).toBeNull()
    expect(pool.query).toHaveBeenCalledTimes(2)
  })

  it('listFavoriteSongs returns mapped songs', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            title: 'My Song',
            status: 'published',
            rights_status: 'owned_by_app',
            duration_ms: 120000,
            is_default_suggestion: false,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tag_list: ['pop']
          }
        ]
      })
    }
    const out = await listFavoriteSongs('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', pool)
    expect(out).toHaveLength(1)
    expect(out[0]?.title).toBe('My Song')
    expect(out[0]?.tags).toEqual(['pop'])
  })

  it('removeFavoriteSong deletes mapping', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) }
    const ok = await removeFavoriteSong(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      pool
    )
    expect(ok).toBe(true)
  })
})
