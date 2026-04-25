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

vi.mock('./src/db/repos/songsRepo.mjs', () => ({
  listSongs: vi.fn(),
  findSongById: vi.fn(),
  listSongsForPartySelection: vi.fn(),
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
const { findSessionByPartyRequestId, findSessionByPartyCode } = sessRepo
const {
  listPlaylistWithSongsForSession,
  hasSongInSessionPlaylist,
  nextPositionAtEnd,
  addSongAtPosition,
  deleteItemForSession,
  compactPositions,
  reorderByItemIds
} = plRepo
const { isSongAllowedOnPartyPlaylist, listDefaultSuggestionSongs, listSongsForBotSelection, mapSongRow } =
  songsRepo

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
  listDefaultSuggestionSongs.mockResolvedValue([
    { id: song1, title: 'S', tags: [], difficulty: 'easy', isDefaultSuggestion: true, audioReady: true, lyricsReady: true }
  ])
  listSongsForBotSelection.mockResolvedValue([])
  mapSongRow.mockImplementation((r) => r)
})

describe('host party playlist', () => {
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
})
