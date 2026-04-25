import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import { createApp } from './src/app.mjs'
import * as songsRepo from './src/db/repos/songsRepo.mjs'
import * as lyricLinesRepo from './src/db/repos/lyricLinesRepo.mjs'

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

vi.mock('./src/db/repos/lyricLinesRepo.mjs', () => ({
  listLinesForSong: vi.fn(),
  replaceAllLinesForSong: vi.fn()
}))

const saUid = '1a2b3c4d-1a2b-1a2b-1a2b-123456789abc'
const songId = 'a1b2c3d4-e5f6-4a0b-8c9d-111111111111'

function saUser() {
  const h = bcrypt.hashSync('p', 4)
  return {
    id: saUid,
    email: 'a@a.dm',
    display_name: 'sa',
    role: 'super_admin',
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

async function loginAgent() {
  const u = saUser()
  findUserByEmail.mockResolvedValue(u)
  findUserById.mockImplementation((id) => (id === saUid ? u : null))
  const app = makeApp()
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ email: u.email, password: 'p' })
  return { agent, u }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/admin/songs/:songId/lyrics', () => {
  it('returns lines and title', async () => {
    songsRepo.findSongById.mockResolvedValue(/** @type {any} */ ({ id: songId, title: 'T' }))
    lyricLinesRepo.listLinesForSong.mockResolvedValue([
      {
        id: '1',
        lineNumber: 0,
        startTimeSeconds: 1,
        endTimeSeconds: 2,
        textEnglish: 'A',
        textHindi: '',
        textHebrew: ''
      }
    ])
    const { agent } = await loginAgent()
    const r = await agent.get(`/api/admin/songs/${songId}/lyrics`)
    expect(r.status).toBe(200)
    expect(r.body.song?.title).toBe('T')
    expect(r.body.lines).toHaveLength(1)
    expect(r.body.lines[0].textEnglish).toBe('A')
  })
})

describe('POST /api/admin/songs/:songId/lyrics', () => {
  it('saves lines transactionally and returns them', async () => {
    songsRepo.findSongById.mockResolvedValue(/** @type {any} */ ({ id: songId, title: 'T' }))
    const out = [
      {
        id: 'i1',
        lineNumber: 0,
        startTimeSeconds: null,
        endTimeSeconds: null,
        textEnglish: 'One',
        textHindi: '',
        textHebrew: ''
      }
    ]
    lyricLinesRepo.replaceAllLinesForSong.mockResolvedValue(out)
    const { agent } = await loginAgent()
    const r = await agent.post(`/api/admin/songs/${songId}/lyrics`).send({
      lines: [
        {
          lineNumber: 0,
          textEnglish: 'One',
          textHindi: '',
          textHebrew: ''
        }
      ]
    })
    expect(r.status).toBe(200)
    expect(lyricLinesRepo.replaceAllLinesForSong).toHaveBeenCalled()
    const argLines = lyricLinesRepo.replaceAllLinesForSong.mock.calls[0][1]
    expect(argLines[0].textEnglish).toBe('One')
    expect(r.body.lines).toEqual(out)
  })

  it('updates to new set of lines (replaces old)', async () => {
    songsRepo.findSongById.mockResolvedValue(/** @type {any} */ ({ id: songId, title: 'T' }))
    const out2 = [
      {
        id: 'n1',
        lineNumber: 0,
        startTimeSeconds: null,
        endTimeSeconds: null,
        textEnglish: 'N',
        textHindi: '',
        textHebrew: ''
      }
    ]
    lyricLinesRepo.replaceAllLinesForSong.mockResolvedValue(out2)
    const { agent } = await loginAgent()
    const r = await agent.post(`/api/admin/songs/${songId}/lyrics`).send({
      lines: [
        { lineNumber: 0, textEnglish: 'N', textHindi: '', textHebrew: '' }
      ]
    })
    expect(r.status).toBe(200)
    expect(lyricLinesRepo.replaceAllLinesForSong).toHaveBeenCalled()
    expect(r.body.lines[0].textEnglish).toBe('N')
  })

  it('deletes all lines when empty array (clear)', async () => {
    songsRepo.findSongById.mockResolvedValue(/** @type {any} */ ({ id: songId, title: 'T' }))
    lyricLinesRepo.replaceAllLinesForSong.mockResolvedValue([])
    const { agent } = await loginAgent()
    const r = await agent
      .post(`/api/admin/songs/${songId}/lyrics`)
      .send({ lines: [] })
    expect(r.status).toBe(200)
    expect(lyricLinesRepo.replaceAllLinesForSong).toHaveBeenCalled()
    const lines = lyricLinesRepo.replaceAllLinesForSong.mock.calls[0][1]
    expect(lines).toEqual([])
  })

  it('rejects duplicate line numbers in payload', async () => {
    songsRepo.findSongById.mockResolvedValue(/** @type {any} */ ({ id: songId, title: 'T' }))
    const { agent } = await loginAgent()
    const r = await agent.post(`/api/admin/songs/${songId}/lyrics`).send({
      lines: [
        { lineNumber: 0, textEnglish: 'A', textHindi: '', textHebrew: '' },
        { lineNumber: 0, textEnglish: 'B', textHindi: '', textHebrew: '' }
      ]
    })
    expect(r.status).toBe(400)
    expect(lyricLinesRepo.replaceAllLinesForSong).not.toHaveBeenCalled()
  })
})
