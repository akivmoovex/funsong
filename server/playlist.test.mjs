import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import { createApp } from './src/app.mjs'
import * as prRepo from './src/db/repos/partyRequestsRepo.mjs'
import * as sessRepo from './src/db/repos/partySessionsRepo.mjs'
import * as plRepo from './src/db/repos/partyPlaylistItemsRepo.mjs'
import * as songsRepo from './src/db/repos/songsRepo.mjs'
import * as controlRepo from './src/db/repos/controlRequestsRepo.mjs'
import * as partyGuestsRepo from './src/db/repos/partyGuestsRepo.mjs'
import * as lyricLinesRepo from './src/db/repos/lyricLinesRepo.mjs'
import * as appSettingsService from './src/services/appSettingsService.mjs'
import * as guestJoinSvc from './src/services/guestJoin.mjs'
import * as partyExpiryService from './src/services/partyExpiryService.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn()
}))

vi.mock('./src/db/repos/partyRequestsRepo.mjs', () => ({
  createRequest: vi.fn(),
  listRequestsByHostId: vi.fn(),
  findRequestById: vi.fn(),
  findRequestByIdForHost: vi.fn(),
  listPendingRequestsForAdmin: vi.fn()
}))

vi.mock('./src/db/repos/partySessionsRepo.mjs', () => ({
  findSessionById: vi.fn(),
  findSessionByPartyRequestId: vi.fn(),
  findSessionByPartyCode: vi.fn(),
  startPartySession: vi.fn(),
  createSession: vi.fn(),
  listSessionsForAdmin: vi.fn(),
  disableSessionById: vi.fn(),
  endPartySessionForHost: vi.fn()
}))

vi.mock('./src/db/repos/partyPlaylistItemsRepo.mjs', () => ({
  listPlaylistBySessionId: vi.fn(),
  listPlaylistWithSongsForSession: vi.fn(),
  hasSongInSessionPlaylist: vi.fn(),
  nextPositionAtEnd: vi.fn(),
  addSongAtPosition: vi.fn(),
  deleteItemById: vi.fn(),
  deleteItemForSession: vi.fn(),
  compactPositions: vi.fn(),
  reorderByItemIds: vi.fn(),
  findPlaylistItemById: vi.fn()
}))

vi.mock('./src/db/repos/controlRequestsRepo.mjs', () => ({
  findById: vi.fn(),
  listPendingBySessionId: vi.fn(),
  createRequest: vi.fn(),
  approveSongRequestById: vi.fn(),
  rejectSongRequestById: vi.fn(),
  listPendingSongRequestsBySessionId: vi.fn(),
  hasPendingSongRequestForSessionSong: vi.fn(),
  hasApprovedSongRequestForSessionSong: vi.fn()
}))

vi.mock('./src/db/repos/partyGuestsRepo.mjs', () => ({
  findGuestByTokenForPartyCode: vi.fn()
}))

vi.mock('./src/db/repos/lyricLinesRepo.mjs', () => ({
  listLinesForSong: vi.fn()
}))

vi.mock('./src/db/repos/songsRepo.mjs', () => ({
  listSongs: vi.fn(),
  findSongById: vi.fn(),
  listSongsForPartySelection: vi.fn(),
  listAvailableSongsForPartyPanel: vi.fn(),
  listDefaultSuggestionSongs: vi.fn(),
  listSongsForBotSelection: vi.fn(),
  isSongAllowedOnPartyPlaylist: vi.fn(),
  getSongStreamMeta: vi.fn(),
  mapSongRow: vi.fn(),
  createSong: vi.fn(),
  updateSongFields: vi.fn(),
  setSongStatus: vi.fn(),
  setSongAudioFields: vi.fn()
}))

vi.mock('./src/services/guestJoin.mjs', () => ({
  getJoinPreview: vi.fn(),
  performGuestJoin: vi.fn()
}))

vi.mock('./src/services/appSettingsService.mjs', () => ({
  getIntSetting: vi.fn()
}))

vi.mock('./src/services/partyExpiryService.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, ensurePartyNotExpired: vi.fn() }
})

const { findRequestByIdForHost } = prRepo
const { findSessionByPartyRequestId, findSessionByPartyCode, startPartySession } = sessRepo
const {
  listPlaylistWithSongsForSession,
  hasSongInSessionPlaylist,
  nextPositionAtEnd,
  addSongAtPosition,
  deleteItemForSession,
  compactPositions,
  reorderByItemIds
} = plRepo
const {
  isSongAllowedOnPartyPlaylist,
  listAvailableSongsForPartyPanel,
  listDefaultSuggestionSongs,
  listSongsForBotSelection,
  mapSongRow
} =
  songsRepo
const {
  createRequest,
  listPendingBySessionId,
  hasPendingSongRequestForSessionSong,
  hasApprovedSongRequestForSessionSong,
  listPendingSongRequestsBySessionId,
  approveSongRequestById,
  rejectSongRequestById
} = controlRepo
const { findGuestByTokenForPartyCode } = partyGuestsRepo
const { listLinesForSong } = lyricLinesRepo
const { getIntSetting } = appSettingsService
const { performGuestJoin } = guestJoinSvc
const { ensurePartyNotExpired } = partyExpiryService

const hostUid = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const prId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sid = 'ssssssss-ssss-4sss-8sss-ssssssssssss'
const sid2 = 'tttttttt-tttt-4ttt-8ttt-tttttttttttt'
const song1 = '11111111-1111-4111-8111-111111111111'
const song2 = '22222222-2222-4222-8222-222222222222'
const plItem1 = 'p1111111-1111-4111-8111-111111111111'
const plItem2 = 'p2222222-2222-4222-8222-222222222222'
const emailH = 'h@e.re'

function makeApp() {
  const client = {
    query: vi.fn().mockImplementation(async (sql) => {
      const s = String(sql)
      if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') return { rows: [] }
      if (s.includes('FOR UPDATE')) return { rows: [{ id: 's' }] }
      if (s.includes('INSERT INTO party_playlist_items')) return { rows: [{ id: 'ins' }] }
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

function songCard(id) {
  return {
    id,
    title: 'Hit',
    difficulty: 'medium',
    tags: ['a'],
    playlistItemId: plItem1,
    position: 0,
    requestedByGuestId: null,
    requestedByGuestDisplayName: null,
    audioReady: true,
    lyricsReady: true
  }
}

function songCardTwo() {
  return {
    id: song2,
    title: 'Second Hit',
    difficulty: 'easy',
    tags: ['b'],
    playlistItemId: plItem2,
    position: 1,
    requestedByGuestId: null,
    requestedByGuestDisplayName: null,
    audioReady: true,
    lyricsReady: true
  }
}

async function loginHost(agent) {
  const h = {
    id: hostUid,
    email: emailH,
    display_name: 'h',
    role: 'host',
    is_active: true,
    password_hash: bcrypt.hashSync('p', 4)
  }
  findUserByEmail.mockResolvedValue(h)
  findUserById.mockImplementation((id) => (id === hostUid ? h : null))
  const r = await agent.post('/api/auth/login').send({ email: emailH, password: 'p' })
  expect(r.status).toBe(200)
}

beforeEach(() => {
  vi.clearAllMocks()
  getIntSetting.mockImplementation(async (key, defaultValue) => {
    if (key === 'max_playlist_songs') return 10
    if (key === 'max_party_guests') return 30
    return defaultValue
  })
  ensurePartyNotExpired.mockResolvedValue({ checked: true, expired: false, closedSessionId: null })
  findRequestByIdForHost.mockResolvedValue({
    id: prId,
    host_id: hostUid,
    status: 'approved',
    party_name: 'P'
  })
  findSessionByPartyRequestId.mockResolvedValue({ id: sid, max_guests: 30, status: 'approved' })
  startPartySession.mockResolvedValue({ id: sid, status: 'active' })
  listAvailableSongsForPartyPanel.mockResolvedValue([
    { id: song1, title: 'S', tags: [], difficulty: 'easy', audioReady: true, lyricsReady: true }
  ])
  listDefaultSuggestionSongs.mockResolvedValue([
    { id: song1, title: 'S', tags: [], difficulty: 'easy', isDefaultSuggestion: true, audioReady: true, lyricsReady: true }
  ])
  listSongsForBotSelection.mockResolvedValue([])
  mapSongRow.mockImplementation((r) => r)
  createRequest.mockResolvedValue({
    id: 'req-song-1',
    session_id: sid,
    party_guest_id: 'guest-1',
    song_id: song1,
    status: 'pending'
  })
  hasPendingSongRequestForSessionSong.mockResolvedValue(false)
  hasApprovedSongRequestForSessionSong.mockResolvedValue(false)
  listPendingBySessionId.mockResolvedValue([])
  listPendingSongRequestsBySessionId.mockResolvedValue([])
  approveSongRequestById.mockResolvedValue({
    id: 'req-song-1',
    session_id: sid,
    party_guest_id: 'guest-1',
    song_id: song1,
    status: 'approved'
  })
  rejectSongRequestById.mockResolvedValue({
    id: 'req-song-1',
    session_id: sid,
    party_guest_id: 'guest-1',
    song_id: song1,
    status: 'rejected'
  })
  findGuestByTokenForPartyCode.mockImplementation(async (token, code) => {
    if (token === 'abc123def' && code === 'MyCode9') {
      return {
        id: 'guest-1',
        display_name: 'Guest',
        language_preference: 'english',
        session_pk: sid,
        session_status: 'active',
        max_guests: 30
      }
    }
    return null
  })
  listLinesForSong.mockResolvedValue([
    { lineNumber: 1, textEnglish: 'Hello', textHindi: 'नमस्ते', textHebrew: 'שלום' },
    { lineNumber: 2, textEnglish: 'World', textHindi: 'दुनिया', textHebrew: 'עולם' }
  ])
})

describe('host party playlist', () => {
  it('host can start approved party (status active)', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    app.set('io', { to: () => ({ emit: vi.fn() }) })
    await loginHost(agent)
    const r = await agent.post(`/api/host/parties/${prId}/start-party`).send({})
    expect(r.status).toBe(200)
    expect(r.body.session?.status).toBe('active')
    expect(startPartySession).toHaveBeenCalled()
  })

  it('host can add song to playlist', async () => {
    listPlaylistWithSongsForSession
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([songCard(song1)])
    isSongAllowedOnPartyPlaylist.mockResolvedValue(true)
    hasSongInSessionPlaylist.mockResolvedValue(false)
    nextPositionAtEnd.mockResolvedValue(0)
    addSongAtPosition.mockResolvedValue({ id: 'new' })
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent
      .post(`/api/host/parties/${prId}/playlist/add`)
      .send({ songId: song1 })
    expect(r.status).toBe(201)
    expect(r.body.playlist).toBeDefined()
    expect(isSongAllowedOnPartyPlaylist).toHaveBeenCalledWith(song1, expect.anything())
  })

  it('host adds two songs and guest playlist exposes both in host order', async () => {
    isSongAllowedOnPartyPlaylist.mockResolvedValue(true)
    hasSongInSessionPlaylist.mockResolvedValue(false)
    nextPositionAtEnd.mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    addSongAtPosition.mockResolvedValueOnce({ id: plItem1 }).mockResolvedValueOnce({ id: plItem2 })
    listPlaylistWithSongsForSession
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([songCard(song1)])
      .mockResolvedValueOnce([songCard(song1)])
      .mockResolvedValueOnce([songCard(song1), songCardTwo()])
      .mockResolvedValueOnce([songCard(song1), songCardTwo()])

    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const a1 = await agent.post(`/api/host/parties/${prId}/playlist/add`).send({ songId: song1 })
    expect(a1.status).toBe(201)
    const a2 = await agent.post(`/api/host/parties/${prId}/playlist/add`).send({ songId: song2 })
    expect(a2.status).toBe(201)
    expect(addSongAtPosition).toHaveBeenCalledTimes(2)

    findSessionByPartyCode.mockResolvedValue({ id: sid, status: 'approved' })
    const g = await request(app).get('/api/party/MyCode9/playlist')
    expect(g.status).toBe(200)
    expect(g.body.playlist).toHaveLength(2)
    expect(g.body.playlist[0]?.title).toBe('Hit')
    expect(g.body.playlist[1]?.title).toBe('Second Hit')
  })

  it('duplicate song blocked (409)', async () => {
    isSongAllowedOnPartyPlaylist.mockResolvedValue(true)
    hasSongInSessionPlaylist.mockResolvedValue(true)
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent
      .post(`/api/host/parties/${prId}/playlist/add`)
      .send({ songId: song1 })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('duplicate_song')
  })

  it('queue add is blocked when playlist is at max_playlist_songs', async () => {
    isSongAllowedOnPartyPlaylist.mockResolvedValue(true)
    hasSongInSessionPlaylist.mockResolvedValue(false)
    getIntSetting.mockImplementation(async (key, defaultValue) => {
      if (key === 'max_playlist_songs') return 1
      return defaultValue
    })
    listPlaylistWithSongsForSession.mockResolvedValue([songCard(song1)])
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent
      .post(`/api/host/parties/${prId}/playlist/add`)
      .send({ songId: song2 })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('queue_full')
    expect(addSongAtPosition).not.toHaveBeenCalled()
  })

  it('disabled/blocked song cannot be added (400)', async () => {
    isSongAllowedOnPartyPlaylist.mockResolvedValue(false)
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent
      .post(`/api/host/parties/${prId}/playlist/add`)
      .send({ songId: song1 })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('song_not_allowed')
  })

  it('reorder moves item up and returns persisted order', async () => {
    const i1 = 'aaaaaaaa-1111-4111-8111-111111111101'
    const i2 = 'aaaaaaaa-1111-4111-8111-111111111102'
    const reordered = [
      { ...songCard(song2), playlistItemId: i2, position: 0, id: song2 },
      { ...songCard(song1), playlistItemId: i1, position: 1, id: song1 }
    ]
    listPlaylistWithSongsForSession
      .mockResolvedValueOnce(reordered)
    reorderByItemIds.mockImplementation(async (sessionId, ids) => {
      expect(ids).toEqual([i2, i1])
      return true
    })
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent
      .post(`/api/host/parties/${prId}/playlist/reorder`)
      .send({ orderedItemIds: [i2, i1] })
    expect(r.status).toBe(200)
    expect(r.body.playlist).toEqual(reordered)
    expect(reorderByItemIds).toHaveBeenCalled()
  })

  it('reorder moves item down and returns persisted order', async () => {
    const i1 = 'aaaaaaaa-1111-4111-8111-111111111101'
    const i2 = 'aaaaaaaa-1111-4111-8111-111111111102'
    const reordered = [
      { ...songCard(song2), playlistItemId: i2, position: 0, id: song2 },
      { ...songCard(song1), playlistItemId: i1, position: 1, id: song1 }
    ]
    listPlaylistWithSongsForSession.mockResolvedValueOnce(reordered)
    reorderByItemIds.mockImplementation(async (sessionId, ids) => {
      expect(ids).toEqual([i2, i1])
      return true
    })
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent
      .post(`/api/host/parties/${prId}/playlist/reorder`)
      .send({ orderedItemIds: [i2, i1] })
    expect(r.status).toBe(200)
    expect(r.body.playlist).toEqual(reordered)
    expect(reorderByItemIds).toHaveBeenCalled()
  })

  it('reorder broadcast emits server-sorted playlist payload', async () => {
    const i1 = 'aaaaaaaa-1111-4111-8111-111111111101'
    const i2 = 'aaaaaaaa-1111-4111-8111-111111111102'
    const reordered = [
      { ...songCard(song2), playlistItemId: i2, position: 0, id: song2 },
      { ...songCard(song1), playlistItemId: i1, position: 1, id: song1 }
    ]
    listPlaylistWithSongsForSession.mockResolvedValueOnce(reordered)
    reorderByItemIds.mockResolvedValue(true)
    const emit = vi.fn()
    const app = makeApp()
    app.set('io', { to: () => ({ emit }) })
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent
      .post(`/api/host/parties/${prId}/playlist/reorder`)
      .send({ orderedItemIds: [i2, i1] })
    expect(r.status).toBe(200)
    expect(emit).toHaveBeenCalledWith(
      'playlist:updated',
      expect.objectContaining({
        source: 'host:reorder',
        playlist: reordered
      })
    )
  })

  it('playlist API exposes available published songs for source panel', async () => {
    listPlaylistWithSongsForSession.mockResolvedValue([])
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.get(`/api/host/parties/${prId}/playlist`)
    expect(r.status).toBe(200)
    expect(Array.isArray(r.body.availableSongs)).toBe(true)
    expect(r.body.availableSongs[0]?.id).toBe(song1)
  })

  it('unavailable/blocked songs do not appear in source panel payload', async () => {
    listPlaylistWithSongsForSession.mockResolvedValue([])
    listAvailableSongsForPartyPanel.mockResolvedValue([
      { id: song1, title: 'Allowed', tags: [], difficulty: 'easy', audioReady: true, lyricsReady: true }
    ])
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.get(`/api/host/parties/${prId}/playlist`)
    expect(r.status).toBe(200)
    expect(r.body.availableSongs).toHaveLength(1)
    expect(r.body.availableSongs[0]?.title).toBe('Allowed')
  })

  it('host sees pending song requests', async () => {
    listPendingSongRequestsBySessionId.mockResolvedValue([
      {
        id: 'req-song-1',
        party_guest_id: 'guest-1',
        guest_display_name: 'Alice',
        song_id: song1,
        song_title: 'Hit',
        status: 'pending',
        created_at: new Date().toISOString()
      }
    ])
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.get(`/api/host/parties/${prId}/song-requests`)
    expect(r.status).toBe(200)
    expect(r.body.requests).toHaveLength(1)
    expect(r.body.requests[0]?.songTitle).toBe('Hit')
    expect(r.body.requests[0]?.guestDisplayName).toBe('Alice')
    expect(listPendingSongRequestsBySessionId).toHaveBeenCalledWith(sid, expect.anything())
  })

  it('host sees multiple pending song requests separately', async () => {
    listPendingSongRequestsBySessionId.mockResolvedValue([
      {
        id: 'req-song-1',
        party_guest_id: 'guest-1',
        guest_display_name: 'Alice',
        song_id: song1,
        song_title: 'Hit',
        status: 'pending',
        created_at: new Date('2026-01-01T00:00:00.000Z').toISOString()
      },
      {
        id: 'req-song-2',
        party_guest_id: 'guest-2',
        song_id: song2,
        guest_display_name: 'Bob',
        song_title: 'Second Hit',
        status: 'pending',
        created_at: new Date('2026-01-01T00:01:00.000Z').toISOString()
      }
    ])
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.get(`/api/host/parties/${prId}/song-requests`)
    expect(r.status).toBe(200)
    expect(r.body.requests).toHaveLength(2)
    expect(r.body.requests[0]?.guestDisplayName).toBe('Alice')
    expect(r.body.requests[1]?.guestDisplayName).toBe('Bob')
  })

  it('host sees pending control requests with song title', async () => {
    listPendingBySessionId.mockResolvedValue([
      {
        id: 'req-ctrl-1',
        party_guest_id: 'guest-1',
        guest_display_name: 'Alice',
        song_id: song1,
        playlist_item_id: plItem1,
        song_title: 'Hit',
        created_at: new Date().toISOString()
      }
    ])
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.get(`/api/host/parties/${prId}/control-requests`)
    expect(r.status).toBe(200)
    expect(r.body.requests).toHaveLength(1)
    expect(r.body.requests[0]?.guestDisplayName).toBe('Alice')
    expect(r.body.requests[0]?.songTitle).toBe('Hit')
    expect(r.body.requests[0]?.playlistItemId).toBe(plItem1)
  })

  it('host approves song request and song appears in playlist', async () => {
    hasSongInSessionPlaylist.mockResolvedValue(false)
    addSongAtPosition.mockResolvedValue({ id: 'new-item' })
    nextPositionAtEnd.mockResolvedValue(1)
    listPlaylistWithSongsForSession.mockResolvedValue([songCard(song1)])
    const app = makeApp()
    app.set('io', { to: () => ({ emit: vi.fn() }) })
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post(`/api/host/parties/${prId}/song-requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab/approve`)
    expect(r.status).toBe(200)
    expect(addSongAtPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: sid,
        songId: song1,
        requestedByGuestId: 'guest-1'
      }),
      expect.anything()
    )
  })

  it('host playlist payload keeps requested-by guest display name', async () => {
    listPlaylistWithSongsForSession.mockResolvedValue([
      {
        ...songCard(song1),
        requestedByGuestId: 'guest-1',
        requestedByGuestDisplayName: 'Alice'
      }
    ])
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.get(`/api/host/parties/${prId}/playlist`)
    expect(r.status).toBe(200)
    expect(r.body.playlist[0]?.requestedByGuestDisplayName).toBe('Alice')
  })

  it('approving song request is blocked when queue is full', async () => {
    hasSongInSessionPlaylist.mockResolvedValue(false)
    getIntSetting.mockImplementation(async (key, defaultValue) => {
      if (key === 'max_playlist_songs') return 1
      return defaultValue
    })
    listPlaylistWithSongsForSession.mockResolvedValue([songCard(song1)])
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post(`/api/host/parties/${prId}/song-requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab/approve`)
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('queue_full')
    expect(addSongAtPosition).not.toHaveBeenCalled()
  })

  it('host rejects song request (song not added)', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post(`/api/host/parties/${prId}/song-requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab/reject`)
    expect(r.status).toBe(200)
    expect(rejectSongRequestById).toHaveBeenCalled()
  })
})

describe('guest party playlist', () => {
  it('guest can view playlist', async () => {
    findSessionByPartyCode.mockResolvedValue({ id: sid, status: 'approved' })
    listPlaylistWithSongsForSession.mockResolvedValue([songCard(song1)])
    const app = makeApp()
    const r = await request(app).get('/api/party/MyCode9/playlist')
    expect(r.status).toBe(200)
    expect(r.body.playlist).toBeDefined()
    expect(Array.isArray(r.body.playlist)).toBe(true)
  })

  it('second guest also sees the added song', async () => {
    findSessionByPartyCode.mockResolvedValue({ id: sid, status: 'approved' })
    listPlaylistWithSongsForSession.mockResolvedValue([songCard(song1)])
    const app = makeApp()
    const r1 = await request(app).get('/api/party/MyCode9/playlist')
    const r2 = await request(app).get('/api/party/MyCode9/playlist')
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    expect(r1.body.playlist[0]?.title).toBe('Hit')
    expect(r2.body.playlist[0]?.title).toBe('Hit')
  })

  it('playlist is scoped to the requested party', async () => {
    findSessionByPartyCode.mockImplementation(async (code) => {
      if (String(code) === 'PartyOne9') return { id: sid, status: 'approved' }
      if (String(code) === 'PartyTwo9') return { id: sid2, status: 'approved' }
      return null
    })
    listPlaylistWithSongsForSession.mockImplementation(async (sessionId) => {
      if (String(sessionId) === sid) {
        return [songCard(song1)]
      }
      return [{ ...songCard('22222222-2222-4222-8222-222222222222'), title: 'Other Party Song' }]
    })
    const app = makeApp()
    const r1 = await request(app).get('/api/party/PartyOne9/playlist')
    const r2 = await request(app).get('/api/party/PartyTwo9/playlist')
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    expect(r1.body.playlist[0]?.title).toBe('Hit')
    expect(r2.body.playlist[0]?.title).toBe('Other Party Song')
    expect(r1.body.playlist[0]?.title).not.toBe(r2.body.playlist[0]?.title)
  })

  it('guest playlist payload keeps requested-by guest display name', async () => {
    findSessionByPartyCode.mockResolvedValue({ id: sid, status: 'approved' })
    listPlaylistWithSongsForSession.mockResolvedValue([
      {
        ...songCard(song1),
        requestedByGuestId: 'guest-1',
        requestedByGuestDisplayName: 'Alice'
      }
    ])
    const app = makeApp()
    const r = await request(app).get('/api/party/MyCode9/playlist')
    expect(r.status).toBe(200)
    expect(r.body.playlist[0]?.requestedByGuestDisplayName).toBe('Alice')
  })

  it('guest can create song request', async () => {
    findSessionByPartyCode.mockResolvedValue({ id: sid, status: 'active' })
    isSongAllowedOnPartyPlaylist.mockResolvedValue(true)
    const app = makeApp()
    const r = await request(app)
      .post('/api/party/MyCode9/request-song')
      .set('Cookie', ['fs_guest=abc123def'])
      .send({ songId: song1 })
    expect(r.status).toBe(201)
    expect(createRequest).toHaveBeenCalled()
  })

  it('guest from another party cannot affect this party', async () => {
    findSessionByPartyCode.mockResolvedValue({ id: sid, status: 'active' })
    const app = makeApp()
    const r = await request(app)
      .post('/api/party/OtherCode9/request-song')
      .set('Cookie', ['fs_guest=abc123def'])
      .send({ songId: song1 })
    expect(r.status).toBe(401)
  })

  it('duplicate pending request is blocked', async () => {
    findSessionByPartyCode.mockResolvedValue({ id: sid, status: 'active' })
    isSongAllowedOnPartyPlaylist.mockResolvedValue(true)
    hasPendingSongRequestForSessionSong.mockResolvedValue(true)
    const app = makeApp()
    const r = await request(app)
      .post('/api/party/MyCode9/request-song')
      .set('Cookie', ['fs_guest=abc123def'])
      .send({ songId: song1 })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('song_request_already_pending')
  })

  it('guest state endpoint is blocked when party is ended', async () => {
    findSessionByPartyCode.mockResolvedValue({ id: sid, status: 'ended' })
    const app = makeApp()
    const r = await request(app)
      .get('/api/party/MyCode9/state')
      .set('Cookie', ['fs_guest=abc123def'])
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('not_available')
  })

  it('guest party info endpoint returns ended session status', async () => {
    findGuestByTokenForPartyCode.mockResolvedValue({
      id: 'guest-1',
      display_name: 'Guest',
      language_preference: 'english',
      session_pk: sid,
      session_status: 'ended',
      max_guests: 30
    })
    const app = makeApp()
    const r = await request(app)
      .get('/api/party/MyCode9')
      .set('Cookie', ['fs_guest=abc123def'])
    expect(r.status).toBe(200)
    expect(r.body.session?.status).toBe('ended')
  })

  it('guest song and control requests are blocked when party is ended', async () => {
    findSessionByPartyCode.mockResolvedValue({ id: sid, status: 'ended' })
    isSongAllowedOnPartyPlaylist.mockResolvedValue(true)
    const app = makeApp()
    const songReq = await request(app)
      .post('/api/party/MyCode9/request-song')
      .set('Cookie', ['fs_guest=abc123def'])
      .send({ songId: song1 })
    expect(songReq.status).toBe(403)
    expect(songReq.body.error).toBe('not_available')

    const controlReq = await request(app)
      .post('/api/party/MyCode9/request-control')
      .set('Cookie', ['fs_guest=abc123def'])
      .send({ songId: song1 })
    expect(controlReq.status).toBe(403)
    expect(controlReq.body.error).toBe('not_available')
  })

  it('joined guest can list available songs (published, non-blocked)', async () => {
    findSessionByPartyCode.mockResolvedValue({ id: sid, status: 'active' })
    listAvailableSongsForPartyPanel.mockResolvedValue([
      {
        id: song1,
        title: 'Allowed Song',
        difficulty: 'easy',
        tags: ['party'],
        status: 'published',
        rightsStatus: 'owned_original',
        audioReady: true,
        lyricsReady: true
      },
      {
        id: song2,
        title: 'Blocked Song',
        difficulty: 'easy',
        tags: [],
        status: 'published',
        rightsStatus: 'blocked',
        audioReady: true,
        lyricsReady: true
      }
    ])
    const app = makeApp()
    const r = await request(app)
      .get('/api/party/MyCode9/available-songs')
      .set('Cookie', ['fs_guest=abc123def'])
    expect(r.status).toBe(200)
    expect(r.body.songs).toHaveLength(1)
    expect(r.body.songs[0]?.title).toBe('Allowed Song')
  })

  it('unauthenticated user cannot list available songs', async () => {
    const app = makeApp()
    const r = await request(app).get('/api/party/MyCode9/available-songs')
    expect(r.status).toBe(401)
  })

  it('guest lyrics preview uses selected guest language', async () => {
    findSessionByPartyCode.mockResolvedValue({ id: sid, status: 'active' })
    findGuestByTokenForPartyCode.mockResolvedValue({
      id: 'guest-1',
      display_name: 'Guest',
      language_preference: 'hindi',
      session_pk: sid,
      session_status: 'active',
      max_guests: 30
    })
    listAvailableSongsForPartyPanel.mockResolvedValue([
      {
        id: song1,
        title: 'Allowed Song',
        difficulty: 'easy',
        tags: ['party'],
        status: 'published',
        rightsStatus: 'owned_original',
        audioReady: true,
        lyricsReady: true
      }
    ])
    const app = makeApp()
    const r = await request(app)
      .get(`/api/party/MyCode9/songs/${song1}/preview`)
      .set('Cookie', ['fs_guest=abc123def'])
    expect(r.status).toBe(200)
    expect(r.body.languagePreference).toBe('hindi')
    expect(r.body.previewLines[0]?.text).toBe('नमस्ते')
  })

  it('guest cannot join auto-closed party after lazy expiry check', async () => {
    ensurePartyNotExpired.mockResolvedValueOnce({ checked: true, expired: true, closedSessionId: sid })
    performGuestJoin.mockResolvedValueOnce({ ok: false, error: 'not_joinable' })
    const app = makeApp()
    const r = await request(app)
      .post('/api/join/MyCode9')
      .send({ displayName: 'Late guest', language: 'english' })
    expect(r.status).toBe(403)
    expect(ensurePartyNotExpired).toHaveBeenCalled()
  })

  it('party state behaves ended after lazy expiry check', async () => {
    ensurePartyNotExpired.mockResolvedValueOnce({ checked: true, expired: true, closedSessionId: sid })
    findSessionByPartyCode.mockResolvedValue({ id: sid, status: 'ended' })
    const app = makeApp()
    const r = await request(app)
      .get('/api/party/MyCode9/state')
      .set('Cookie', ['fs_guest=abc123def'])
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('not_available')
    expect(ensurePartyNotExpired).toHaveBeenCalled()
  })
})
