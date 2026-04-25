import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import { createApp } from './src/app.mjs'
import * as songsRepo from './src/db/repos/songsRepo.mjs'
import { replaceTagsForSong } from './src/db/repos/songTagsRepo.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn()
}))

vi.mock('./src/db/repos/songsRepo.mjs', () => ({
  listSongs: vi.fn(),
  findSongById: vi.fn(),
  createSong: vi.fn(),
  updateSongFields: vi.fn(),
  setSongStatus: vi.fn(),
  listSongsForPartySelection: vi.fn(),
  getSongStreamMeta: vi.fn(),
  setSongAudioFields: vi.fn(),
  mapSongRow: vi.fn()
}))

vi.mock('./src/db/repos/songTagsRepo.mjs', () => ({
  replaceTagsForSong: vi.fn().mockResolvedValue(undefined)
}))

const songSample = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Karaoke Hit',
  movieName: 'Film',
  originalArtist: 'Singer',
  composer: 'C1',
  lyricist: 'L1',
  year: 2019,
  durationMs: 200000,
  durationSeconds: 200,
  difficulty: 'medium',
  status: 'draft',
  rightsStatus: 'licensed',
  isDefaultSuggestion: false,
  instrumentalAudioPath: null,
  audioFileUrl: null,
  audioMimeType: null,
  tags: ['dance'],
  createdBy: '1a2b3c4d-1a2b-1a2b-1a2b-123456789abc',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const hostUid = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const saUid = '1a2b3c4d-1a2b-1a2b-1a2b-123456789abc'

function makeUser(role) {
  const h = bcrypt.hashSync('goodpass', 4)
  const hostEmail = 'h@e.re'
  return {
    id: role === 'super_admin' ? saUid : hostUid,
    email: role === 'super_admin' ? 's@a.dm' : hostEmail,
    display_name: role,
    role,
    is_active: true,
    password_hash: h
  }
}

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('admin songs API (super admin)', () => {
  it('POST /api/admin/songs creates a song (super admin)', async () => {
    const sa = makeUser('super_admin')
    findUserByEmail.mockResolvedValue(sa)
    findUserById.mockImplementation((id) => (id === saUid ? sa : null))
    songsRepo.createSong.mockResolvedValue(/** @type {any} */ (songSample))

    const app = makeApp()
    const agent = request.agent(app)
    const login = await agent
      .post('/api/auth/login')
      .send({ email: sa.email, password: 'goodpass' })
    expect(login.status).toBe(200)
    const r = await agent.post('/api/admin/songs').send({ title: 'Karaoke Hit' })
    expect(r.status).toBe(201)
    expect(songsRepo.createSong).toHaveBeenCalled()
    expect(songsRepo.createSong.mock.calls[0][0].title).toBe('Karaoke Hit')
    expect(r.body.song?.title).toBe('Karaoke Hit')
  })

  it('host cannot access /api/admin/songs', async () => {
    const h = makeUser('host')
    findUserByEmail.mockResolvedValue(h)
    findUserById.mockImplementation((id) => (id === hostUid ? h : null))
    const app = makeApp()
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: h.email, password: 'goodpass' })
    const r = await agent.get('/api/admin/songs')
    expect(r.status).toBe(403)
    expect(songsRepo.listSongs).not.toHaveBeenCalled()
  })
})

describe('songs/selectable (host, party-safe catalog)', () => {
  it('returns what listSongsForPartySelection provides (excludes blocked at DB layer)', async () => {
    const h = makeUser('host')
    findUserByEmail.mockResolvedValue(h)
    findUserById.mockImplementation((id) => (id === hostUid ? h : null))
    const ok = { ...songSample, status: 'published', rightsStatus: 'licensed' }
    songsRepo.listSongsForPartySelection.mockResolvedValue([ok])

    const app = makeApp()
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: h.email, password: 'goodpass' })
    const r = await agent.get('/api/songs/selectable')
    expect(r.status).toBe(200)
    expect(songsRepo.listSongsForPartySelection).toHaveBeenCalled()
    expect(r.body.songs).toEqual([ok])
  })
})

describe('admin tags + blocked behavior', () => {
  it('POST /api/admin/songs with tags calls replaceTagsForSong', async () => {
    const sa = makeUser('super_admin')
    findUserByEmail.mockResolvedValue(sa)
    findUserById.mockImplementation((id) => (id === saUid ? sa : null))
    songsRepo.createSong.mockResolvedValue(/** @type {any} */ (songSample))
    songsRepo.findSongById.mockResolvedValue(/** @type {any} */ (songSample))

    const app = makeApp()
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: sa.email, password: 'goodpass' })
    const r = await agent
      .post('/api/admin/songs')
      .send({ title: 'With Tags', tags: ['A', 'B', 'A'] })
    expect(r.status).toBe(201)
    expect(replaceTagsForSong).toHaveBeenCalledWith(
      songSample.id,
      ['A', 'B', 'A'],
      expect.anything()
    )
  })

  it('selectable is empty when catalog has no party-ready songs (e.g. all blocked)', async () => {
    const h = makeUser('host')
    findUserByEmail.mockResolvedValue(h)
    findUserById.mockImplementation((id) => (id === hostUid ? h : null))
    songsRepo.listSongsForPartySelection.mockResolvedValue([])

    const app = makeApp()
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: h.email, password: 'goodpass' })
    const r = await agent.get('/api/songs/selectable')
    expect(r.status).toBe(200)
    expect(r.body.songs).toEqual([])
  })
})
