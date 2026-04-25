import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { createApp } from './src/app.mjs'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import * as prRepo from './src/db/repos/partyRequestsRepo.mjs'
import * as sessRepo from './src/db/repos/partySessionsRepo.mjs'
import * as plRepo from './src/db/repos/partyPlaylistItemsRepo.mjs'
import * as songsRepo from './src/db/repos/songsRepo.mjs'
import * as controlRepo from './src/db/repos/controlRequestsRepo.mjs'
import * as partyGuestsRepo from './src/db/repos/partyGuestsRepo.mjs'
import * as appSettingsService from './src/services/appSettingsService.mjs'
import * as partySongControl from './src/services/partySongControl.mjs'
import * as partyKaraokeState from './src/services/partyKaraokeState.mjs'
import * as partyExpiryService from './src/services/partyExpiryService.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn()
}))

vi.mock('./src/db/repos/partyRequestsRepo.mjs', () => ({
  findRequestByIdForHost: vi.fn()
}))

vi.mock('./src/db/repos/partySessionsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return {
    ...m,
    findSessionById: vi.fn(),
    findSessionByPartyRequestId: vi.fn(),
    findSessionByPartyCode: vi.fn(),
    startPartySession: vi.fn(),
    endPartySessionForHost: vi.fn(),
    setCurrentControllerGuest: vi.fn(),
    setControllerAudioEnabled: vi.fn()
  }
})

vi.mock('./src/db/repos/partyPlaylistItemsRepo.mjs', () => ({
  listPlaylistWithSongsForSession: vi.fn(),
  hasSongInSessionPlaylist: vi.fn(),
  nextPositionAtEnd: vi.fn(),
  addSongAtPosition: vi.fn(),
  reorderByItemIds: vi.fn(),
  deleteItemForSession: vi.fn(),
  compactPositions: vi.fn()
}))

vi.mock('./src/db/repos/songsRepo.mjs', () => ({
  isSongAllowedOnPartyPlaylist: vi.fn(),
  listAvailableSongsForPartyPanel: vi.fn(),
  listDefaultSuggestionSongs: vi.fn(),
  listSongsForBotSelection: vi.fn(),
  mapSongRow: vi.fn()
}))

vi.mock('./src/db/repos/controlRequestsRepo.mjs', () => ({
  findById: vi.fn(),
  listPendingBySessionId: vi.fn(),
  createRequest: vi.fn(),
  hasPendingControlForGuest: vi.fn(),
  approveRequestById: vi.fn(),
  rejectOtherPendingForSession: vi.fn(),
  rejectRequestById: vi.fn(),
  hasPendingSongRequestForSessionSong: vi.fn(),
  hasApprovedSongRequestForSessionSong: vi.fn(),
  listPendingSongRequestsBySessionId: vi.fn(),
  approveSongRequestById: vi.fn(),
  rejectSongRequestById: vi.fn()
}))

vi.mock('./src/db/repos/partyGuestsRepo.mjs', () => ({
  findGuestByTokenForPartyCode: vi.fn()
}))

vi.mock('./src/services/appSettingsService.mjs', () => ({
  getIntSetting: vi.fn()
}))

vi.mock('./src/services/partySongControl.mjs', () => ({
  startPartySong: vi.fn(),
  setPartySongPlaybackOp: vi.fn()
}))

vi.mock('./src/services/partyKaraokeState.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, buildPartyKaraokeState: vi.fn() }
})

vi.mock('./src/services/partyExpiryService.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, ensurePartyNotExpired: vi.fn() }
})

const hostUid = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const prId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sid = 'ssssssss-ssss-4sss-8sss-ssssssssssss'
const song1 = '11111111-1111-4111-8111-111111111111'
const song2 = '22222222-2222-4222-8222-222222222222'
const reqControlId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const reqSongId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const pl1 = 'aaaaaaaa-1111-4111-8111-111111111101'
const pl2 = 'aaaaaaaa-1111-4111-8111-111111111102'
const emailH = 'h@e.re'

const { findRequestByIdForHost } = prRepo
const {
  findSessionById,
  findSessionByPartyRequestId,
  findSessionByPartyCode,
  startPartySession,
  endPartySessionForHost,
  setCurrentControllerGuest
} = sessRepo
const { listPlaylistWithSongsForSession, hasSongInSessionPlaylist, nextPositionAtEnd, addSongAtPosition, reorderByItemIds } =
  plRepo
const { isSongAllowedOnPartyPlaylist, listAvailableSongsForPartyPanel, listDefaultSuggestionSongs, listSongsForBotSelection, mapSongRow } =
  songsRepo
const {
  findById,
  listPendingBySessionId,
  createRequest,
  hasPendingControlForGuest,
  approveRequestById,
  rejectOtherPendingForSession,
  hasPendingSongRequestForSessionSong,
  hasApprovedSongRequestForSessionSong,
  listPendingSongRequestsBySessionId,
  approveSongRequestById
} = controlRepo
const { findGuestByTokenForPartyCode } = partyGuestsRepo
const { getIntSetting } = appSettingsService
const { startPartySong } = partySongControl
const { buildPartyKaraokeState } = partyKaraokeState
const { ensurePartyNotExpired } = partyExpiryService

function makeApp() {
  const client = {
    query: vi.fn().mockImplementation(async (sql) => {
      const s = String(sql)
      if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') return { rows: [] }
      if (s.includes('FOR UPDATE')) return { rows: [{ id: sid }] }
      return { rows: [] }
    }),
    release: vi.fn()
  }
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({
      connect: () => Promise.resolve(client),
      query: async () => ({ rows: [] })
    })
  })
}

async function loginHost(agent) {
  const h = {
    id: hostUid,
    email: emailH,
    display_name: 'Host',
    role: 'host',
    is_active: true,
    password_hash: bcrypt.hashSync('p', 4)
  }
  findUserByEmail.mockResolvedValue(h)
  findUserById.mockImplementation((id) => (id === hostUid ? h : null))
  const r = await agent.post('/api/auth/login').send({ email: emailH, password: 'p' })
  expect(r.status).toBe(200)
}

describe('release hardening integration fallback flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensurePartyNotExpired.mockResolvedValue({ checked: true, expired: false, closedSessionId: null })
    findRequestByIdForHost.mockResolvedValue({ id: prId, host_id: hostUid, status: 'approved', party_name: 'P' })
    findSessionByPartyRequestId.mockResolvedValue({
      id: sid,
      status: 'approved',
      max_guests: 30,
      current_controller_party_guest_id: null
    })
    findSessionById.mockResolvedValue({
      id: sid,
      status: 'active',
      party_request_id: prId,
      current_controller_party_guest_id: null
    })
    findSessionByPartyCode.mockResolvedValue({ id: sid, status: 'active' })
    startPartySession.mockResolvedValue({ id: sid, status: 'active' })
    endPartySessionForHost.mockResolvedValue({ ok: true, session: { id: sid, status: 'ended' } })
    setCurrentControllerGuest.mockResolvedValue({ id: sid, current_controller_party_guest_id: 'guest-1' })

    listPlaylistWithSongsForSession.mockResolvedValue([
      {
        playlistItemId: pl1,
        position: 0,
        itemStatus: 'pending',
        id: song1,
        title: 'Song One',
        difficulty: 'easy',
        tags: [],
        audioReady: true,
        lyricsReady: true
      },
      {
        playlistItemId: pl2,
        position: 1,
        itemStatus: 'pending',
        id: song2,
        title: 'Song Two',
        difficulty: 'easy',
        tags: [],
        audioReady: true,
        lyricsReady: true
      }
    ])
    hasSongInSessionPlaylist.mockResolvedValue(false)
    nextPositionAtEnd.mockResolvedValue(2)
    addSongAtPosition.mockResolvedValue({ id: 'p3' })
    reorderByItemIds.mockResolvedValue(true)

    isSongAllowedOnPartyPlaylist.mockResolvedValue(true)
    listAvailableSongsForPartyPanel.mockResolvedValue([])
    listDefaultSuggestionSongs.mockResolvedValue([])
    listSongsForBotSelection.mockResolvedValue([])
    mapSongRow.mockImplementation((r) => r)

    findGuestByTokenForPartyCode.mockImplementation(async (token, code) => {
      if (String(code) !== 'MyCode9') return null
      if (String(token) === 'abc123def') {
        return {
          id: 'guest-1',
          display_name: 'Alice',
          language_preference: 'english',
          session_pk: sid,
          session_status: 'active',
          max_guests: 30
        }
      }
      if (String(token) === 'xyz123abc') {
        return {
          id: 'guest-2',
          display_name: 'Bob',
          language_preference: 'english',
          session_pk: sid,
          session_status: 'active',
          max_guests: 30
        }
      }
      return null
    })

    hasPendingControlForGuest.mockResolvedValue(false)
    hasPendingSongRequestForSessionSong.mockResolvedValue(false)
    hasApprovedSongRequestForSessionSong.mockResolvedValue(false)
    createRequest.mockImplementation(async (o) => {
      if (o.requestKind === 'song') {
        return { id: reqSongId, session_id: sid, party_guest_id: 'guest-1', song_id: song2, status: 'pending' }
      }
      return { id: reqControlId, session_id: sid, party_guest_id: 'guest-1', song_id: song1, status: 'pending' }
    })
    findById.mockResolvedValue({ id: reqControlId, session_id: sid, party_guest_id: 'guest-1', status: 'pending' })
    listPendingBySessionId.mockResolvedValue([
      {
        id: reqControlId,
        party_guest_id: 'guest-1',
        guest_display_name: 'Alice',
        song_id: song1,
        song_title: 'Song One',
        created_at: new Date().toISOString()
      }
    ])
    approveRequestById.mockResolvedValue({ id: reqControlId, session_id: sid, party_guest_id: 'guest-1', status: 'approved' })
    rejectOtherPendingForSession.mockResolvedValue(undefined)
    listPendingSongRequestsBySessionId.mockResolvedValue([
      {
        id: reqSongId,
        party_guest_id: 'guest-1',
        guest_display_name: 'Alice',
        song_id: song2,
        song_title: 'Song Two',
        status: 'pending',
        created_at: new Date().toISOString()
      }
    ])
    approveSongRequestById.mockResolvedValue({
      id: reqSongId,
      session_id: sid,
      party_guest_id: 'guest-1',
      song_id: song2,
      status: 'approved'
    })

    getIntSetting.mockImplementation(async (k, d) => {
      if (k === 'max_playlist_songs') return 10
      if (k === 'max_party_guests') return 30
      return d
    })
    buildPartyKaraokeState.mockResolvedValue({
      sessionId: sid,
      sessionStatus: 'active',
      connectedGuestCount: 2
    })
    startPartySong.mockResolvedValue({
      ok: true,
      state: { sessionId: sid, activeSong: { id: song1, title: 'Song One' }, activePlaylistItemId: 'p1', playbackStatus: 'playing' }
    })
  })

  it('covers join/reorder/start/control/suggest/approve/end with API+socket flow', async () => {
    const emit = vi.fn()
    const app = makeApp()
    app.set('io', { to: () => ({ emit }) })
    const agent = request.agent(app)
    await loginHost(agent)

    const add1 = await agent.post(`/api/host/parties/${prId}/playlist/add`).send({ songId: song1 })
    expect(add1.status).toBe(201)
    const add2 = await agent.post(`/api/host/parties/${prId}/playlist/add`).send({ songId: song2 })
    expect(add2.status).toBe(201)

    const reorder = await agent.post(`/api/host/parties/${prId}/playlist/reorder`).send({
      orderedItemIds: [pl2, pl1]
    })
    expect(reorder.status).toBe(200)

    const startPartyResp = await agent.post(`/api/host/parties/${prId}/start-party`).send({})
    expect(startPartyResp.status).toBe(200)
    const startSongResp = await agent.post(`/api/host/parties/${prId}/start-song`).send({ playlistItemId: pl1 })
    expect(startSongResp.status).toBe(200)

    const ctrlReq = await request(app)
      .post('/api/party/MyCode9/request-control')
      .set('Cookie', ['fs_guest=abc123def'])
      .send({})
    expect(ctrlReq.status).toBe(201)

    const hostCtrlList = await agent.get(`/api/host/parties/${prId}/control-requests`)
    expect(hostCtrlList.status).toBe(200)
    expect(hostCtrlList.body.requests[0]?.guestDisplayName).toBe('Alice')

    const ctrlApprove = await agent.post(`/api/host/control-requests/${reqControlId}/approve`)
    expect(ctrlApprove.status).toBe(200)

    const songReq = await request(app)
      .post('/api/party/MyCode9/request-song')
      .set('Cookie', ['fs_guest=abc123def'])
      .send({ songId: song2 })
    expect(songReq.status).toBe(201)

    const songReqList = await agent.get(`/api/host/parties/${prId}/song-requests`)
    expect(songReqList.status).toBe(200)
    expect(songReqList.body.requests[0]?.guestDisplayName).toBe('Alice')

    const songApprove = await agent.post(`/api/host/parties/${prId}/song-requests/${reqSongId}/approve`)
    expect(songApprove.status).toBe(200)

    const endParty = await agent.post(`/api/host/parties/${prId}/end-party`).send({})
    expect(endParty.status).toBe(200)

    expect(emit).toHaveBeenCalledWith(
      'playlist:updated',
      expect.objectContaining({ source: 'host:reorder' })
    )
    expect(emit).toHaveBeenCalledWith(
      'control:approved',
      expect.objectContaining({ requestId: reqControlId })
    )
    expect(emit).toHaveBeenCalledWith(
      'party:ended',
      expect.objectContaining({ sessionId: sid })
    )
  })
})

