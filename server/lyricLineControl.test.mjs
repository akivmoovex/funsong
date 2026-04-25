import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as lyricLinesRepo from './src/db/repos/lyricLinesRepo.mjs'
import * as partyEventsRepo from './src/db/repos/partyEventsRepo.mjs'
import * as partySongControl from './src/services/partySongControl.mjs'
import * as partySessionsRepo from './src/db/repos/partySessionsRepo.mjs'
import {
  canControlLyrics,
  lineAfterNext,
  lineAfterPrevious,
  applyLyricLineAction,
  restartLineFromSorted
} from './src/services/lyricLineControl.mjs'

vi.mock('./src/db/repos/lyricLinesRepo.mjs', () => ({
  listLinesForSong: vi.fn()
}))
vi.mock('./src/db/repos/partyEventsRepo.mjs', () => ({
  appendEvent: vi.fn()
}))
vi.mock('./src/services/partySongControl.mjs', () => ({
  setPartySongPlaybackOp: vi.fn()
}))
vi.mock('./src/db/repos/partySessionsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, findSessionById: vi.fn(), updateSessionCurrentLine: vi.fn() }
})

const SESSION_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const SONG = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const G_CTRL = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'
const G_OTHER = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'

const lines12 = [
  { lineNumber: 1, textEnglish: 'a' },
  { lineNumber: 2, textEnglish: 'b' }
]

const pool = /** @type {import('pg').Pool} */ (/** @type {unknown} */ ({}))

beforeEach(() => {
  vi.clearAllMocks()
  lyricLinesRepo.listLinesForSong.mockResolvedValue(lines12)
  partyEventsRepo.appendEvent.mockResolvedValue(undefined)
})

describe('lyric line helpers', () => {
  it('lineAfterNext at last line finishes', () => {
    const s = [1, 2, 3]
    expect(lineAfterNext(s, 3)).toEqual({ nextLine: 3, finishSong: true })
  })

  it('lineAfterNext moves forward', () => {
    expect(lineAfterNext([1, 2, 3], 1)).toEqual({ nextLine: 2, finishSong: false })
  })

  it('lineAfterPrevious clamps to min', () => {
    expect(lineAfterPrevious([1, 2, 3], 1)).toBe(1)
  })

  it('restartLineFromSorted prefers 1', () => {
    expect(restartLineFromSorted([1, 2, 3])).toBe(1)
  })
})

describe('canControlLyrics', () => {
  const session = { current_controller_party_guest_id: G_CTRL }

  it('allows host and admin', () => {
    expect(
      canControlLyrics(/** @type {any} */ (session), { role: 'host', partyGuestId: null })
    ).toBe(true)
    expect(
      canControlLyrics(/** @type {any} */ (session), { role: 'admin', partyGuestId: null })
    ).toBe(true)
  })

  it('allows matching controller guest', () => {
    expect(
      canControlLyrics(/** @type {any} */ (session), { role: 'guest', partyGuestId: G_CTRL })
    ).toBe(true)
  })

  it('denies other guest', () => {
    expect(
      canControlLyrics(/** @type {any} */ (session), { role: 'guest', partyGuestId: G_OTHER })
    ).toBe(false)
  })
})

describe('applyLyricLineAction (mocked DB)', () => {
  it('moves next', async () => {
    const session1 = {
      id: SESSION_ID,
      status: 'active',
      active_song_id: SONG,
      active_playlist_item_id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10',
      current_line_number: 1
    }
    const session2 = { ...session1, current_line_number: 2 }
    partySessionsRepo.findSessionById.mockReset()
    partySessionsRepo.updateSessionCurrentLine.mockReset()
    partySessionsRepo.findSessionById.mockResolvedValue(/** @type {any} */ (session1))
    partySessionsRepo.updateSessionCurrentLine.mockResolvedValue(/** @type {any} */ (session2))

    const r = await applyLyricLineAction(
      pool,
      SESSION_ID,
      'next',
      {}
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.finished).toBe(false)
    if (r.finished) return
    expect(r.currentLineNumber).toBe(2)
  })

  it('finishes on next from last line', async () => {
    const sessionLast = {
      id: SESSION_ID,
      status: 'active',
      active_song_id: SONG,
      active_playlist_item_id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10',
      current_line_number: 2
    }
    partySessionsRepo.findSessionById.mockReset()
    partySessionsRepo.updateSessionCurrentLine.mockReset()
    partySessionsRepo.findSessionById.mockResolvedValue(/** @type {any} */ (sessionLast))
    partySongControl.setPartySongPlaybackOp.mockReset()
    partySongControl.setPartySongPlaybackOp.mockResolvedValue({ ok: true, state: {} })
    const r = await applyLyricLineAction(pool, SESSION_ID, 'next', {})
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.finished).toBe(true)
    expect(partySongControl.setPartySongPlaybackOp).toHaveBeenCalled()
  })

  it('moves previous and does not go below first line', async () => {
    const sessionAtFirst = {
      id: SESSION_ID,
      status: 'active',
      active_song_id: SONG,
      active_playlist_item_id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10',
      current_line_number: 1
    }
    partySessionsRepo.findSessionById.mockReset()
    partySessionsRepo.updateSessionCurrentLine.mockReset()
    partySessionsRepo.findSessionById.mockResolvedValue(/** @type {any} */ (sessionAtFirst))
    partySessionsRepo.updateSessionCurrentLine.mockResolvedValue(/** @type {any} */ (sessionAtFirst))
    const r = await applyLyricLineAction(pool, SESSION_ID, 'previous', {})
    expect(r.ok).toBe(true)
    if (!r.ok || r.finished) return
    expect(r.currentLineNumber).toBe(1)
    expect(partySessionsRepo.updateSessionCurrentLine).toHaveBeenCalledWith(SESSION_ID, 1, pool)
  })

  it('rejects lyric control when session is disabled', async () => {
    partySessionsRepo.findSessionById.mockResolvedValue(
      /** @type {any} */ ({
        id: SESSION_ID,
        status: 'disabled',
        active_song_id: SONG,
        current_line_number: 1
      })
    )
    const r = await applyLyricLineAction(pool, SESSION_ID, 'next', {})
    expect(r).toEqual({ ok: false, error: 'session_closed' })
  })
})
