import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./src/db/repos/lyricLinesRepo.mjs', () => ({
  listLinesForSong: vi.fn()
}))
vi.mock('./src/db/repos/partyPlaylistItemsRepo.mjs', () => ({
  findPlaylistItemById: vi.fn(),
  setPlaylistItemsForStart: vi.fn()
}))
vi.mock('./src/db/repos/songsRepo.mjs', () => ({
  isSongAllowedOnPartyPlaylist: vi.fn()
}))
vi.mock('./src/db/repos/partyEventsRepo.mjs', () => ({
  appendEvent: vi.fn()
}))
vi.mock('./src/services/partyKaraokeState.mjs', () => ({
  buildPartyKaraokeState: vi.fn()
}))

import { listLinesForSong } from './src/db/repos/lyricLinesRepo.mjs'
import * as plRepo from './src/db/repos/partyPlaylistItemsRepo.mjs'
import { isSongAllowedOnPartyPlaylist } from './src/db/repos/songsRepo.mjs'
import { startPartySong } from './src/services/partySongControl.mjs'

const sid = '11111111-1111-4111-8111-111111111111'
const plItem = '22222222-2222-4222-8222-222222222222'
const song = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('startPartySong', () => {
  it('returns session_closed when party session is ended (V1: host end party blocks song start)', async () => {
    plRepo.findPlaylistItemById.mockResolvedValue({ session_id: sid, song_id: song })
    isSongAllowedOnPartyPlaylist.mockResolvedValue(true)
    const pool = { connect: vi.fn() }
    const r = await startPartySong(/** @type {any} */ (pool), {
      session: { id: sid, status: 'ended' },
      playlistItemId: plItem
    })
    expect(r).toEqual({ ok: false, error: 'session_closed' })
  })

  it('returns session_closed when party session is disabled (V1: disabled blocks song start)', async () => {
    plRepo.findPlaylistItemById.mockResolvedValue({ session_id: sid, song_id: song })
    isSongAllowedOnPartyPlaylist.mockResolvedValue(true)
    const pool = { connect: vi.fn() }
    const r = await startPartySong(/** @type {any} */ (pool), {
      session: { id: sid, status: 'disabled' },
      playlistItemId: plItem
    })
    expect(r).toEqual({ ok: false, error: 'session_closed' })
  })

  it('returns song_not_available when isSongAllowedOnPartyPlaylist is false (e.g. disabled song)', async () => {
    plRepo.findPlaylistItemById.mockResolvedValue({ session_id: sid, song_id: song })
    isSongAllowedOnPartyPlaylist.mockResolvedValue(false)
    const pool = { connect: vi.fn() }
    const r = await startPartySong(/** @type {any} */ (pool), {
      session: { id: sid, status: 'active' },
      playlistItemId: plItem
    })
    expect(r).toEqual({ ok: false, error: 'song_not_available' })
    expect(listLinesForSong).not.toHaveBeenCalled()
    expect(pool.connect).not.toHaveBeenCalled()
  })
})
