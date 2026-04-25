import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as songsRepo from './songsRepo.mjs'
import { listPlaylistWithSongsForSession } from './partyPlaylistItemsRepo.mjs'

vi.mock('./songsRepo.mjs', () => ({
  mapSongRow: vi.fn()
}))

const sessionId = 'ssssssss-ssss-4sss-8sss-ssssssssssss'

function songBase(id, title) {
  return {
    id,
    title,
    movieName: null,
    originalArtist: null,
    composer: null,
    lyricist: null,
    year: null,
    durationMs: null,
    durationSeconds: null,
    difficulty: 'easy',
    status: 'published',
    rightsStatus: 'owned_by_app',
    isDefaultSuggestion: false,
    instrumentalAudioPath: null,
    audioFileUrl: null,
    audioMimeType: null,
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: []
  }
}

describe('partyPlaylistItemsRepo listPlaylistWithSongsForSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters out rows mapSongRow cannot map', async () => {
    const rows = [
      {
        playlist_item_id: 'p1',
        position: 0,
        item_status: 'pending',
        requested_by_guest_id: null,
        requested_by_guest_display_name: null,
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Skip',
        tag_list: [],
        audio_ok: true,
        lyrics_ok: true
      },
      {
        playlist_item_id: 'p2',
        position: 1,
        item_status: 'pending',
        requested_by_guest_id: null,
        requested_by_guest_display_name: null,
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Keep',
        tag_list: [],
        audio_ok: true,
        lyrics_ok: true
      }
    ]
    const pool = { query: vi.fn().mockResolvedValue({ rows }) }
    songsRepo.mapSongRow
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(songBase('22222222-2222-4222-8222-222222222222', 'Keep'))
    const out = await listPlaylistWithSongsForSession(sessionId, pool)
    expect(out).toHaveLength(1)
    expect(out[0]?.playlistItemId).toBe('p2')
    expect(out[0]?.title).toBe('Keep')
  })

  it('returns empty when all rows fail mapping', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            playlist_item_id: 'p1',
            position: 0,
            item_status: 'pending',
            requested_by_guest_id: null,
            requested_by_guest_display_name: null,
            id: '11111111-1111-4111-8111-111111111111',
            title: 'X',
            tag_list: [],
            audio_ok: true,
            lyrics_ok: true
          }
        ]
      })
    }
    songsRepo.mapSongRow.mockReturnValue(null)
    const out = await listPlaylistWithSongsForSession(sessionId, pool)
    expect(out).toEqual([])
  })
})
