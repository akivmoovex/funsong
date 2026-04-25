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

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
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

const hostUid = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const prId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sid = 'ssssssss-ssss-4sss-8sss-ssssssssssss'
const song1 = '11111111-1111-4111-8111-111111111111'
const plItem1 = 'p1111111-1111-4111-8111-111111111111'
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

  it('reorder updates order', async () => {
    const i1 = 'aaaaaaaa-1111-4111-8111-111111111101'
    const i2 = 'aaaaaaaa-1111-4111-8111-111111111102'
    listPlaylistWithSongsForSession
      .mockResolvedValueOnce([
        { ...songCard(song1), playlistItemId: i1, position: 0, id: song1 },
        { ...songCard(song1), playlistItemId: i2, id: '22222222-2222-4222-8222-222222222222' }
      ])
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
    expect(reorderByItemIds).toHaveBeenCalled()
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
  })

  it('host sees pending control requests with song title', async () => {
    listPendingBySessionId.mockResolvedValue([
      {
        id: 'req-ctrl-1',
        party_guest_id: 'guest-1',
        guest_display_name: 'Alice',
        song_id: song1,
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
    expect(r.body.requests[0]?.songTitle).toBe('Hit')
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
    expect(addSongAtPosition).toHaveBeenCalled()
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
    const sid2 = 'tttttttt-tttt-4ttt-8ttt-tttttttttttt'
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
})
