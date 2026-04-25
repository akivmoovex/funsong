import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import { createApp } from './src/app.mjs'
import * as songsRepo from './src/db/repos/songsRepo.mjs'

const writeFile = vi.hoisted(() => vi.fn().mockResolvedValue())
const unlink = vi.hoisted(() => vi.fn().mockResolvedValue())

vi.mock('node:fs/promises', async (importOriginal) => {
  const a = await importOriginal()
  return {
    ...a,
    writeFile,
    unlink
  }
})

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

const saUid = '1a2b3c4d-1a2b-1a2b-1a2b-123456789abc'
const songId = 'a1b2c3d4-e5f6-4a0b-8c9d-111111111111'

const songOut = {
  id: songId,
  title: 'With audio',
  audioFileUrl: `/api/songs/${songId}/audio`,
  audioMimeType: 'audio/mpeg',
  status: 'draft',
  rightsStatus: 'licensed',
  tags: []
}

const mp3Id3 = Buffer.from([0x49, 0x44, 0x33, 0, 0, 0, 0, 0, 0, 0])

function saUser() {
  const h = bcrypt.hashSync('x', 4)
  return {
    id: saUid,
    email: 'a@a.dm',
    display_name: 'sa',
    role: 'super_admin',
    is_active: true,
    password_hash: h
  }
}

beforeAll(() => {
  process.env.MAX_AUDIO_UPLOAD_MB = '15'
})

afterEach(() => {
  process.env.MAX_AUDIO_UPLOAD_MB = '15'
  vi.clearAllMocks()
})

describe('POST /api/admin/songs/:songId/audio', () => {
  function makeApp() {
    return createApp({
      sessionStore: new session.MemoryStore(),
      getPool: () => ({ query: async () => ({ rows: [] }) })
    })
  }

  it('rejects non-mp3 mimetype (with .mp3 name)', async () => {
    const u = saUser()
    findUserByEmail.mockResolvedValue(u)
    findUserById.mockImplementation((id) => (id === saUid ? u : null))
    const app = makeApp()
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: u.email, password: 'x' })
    const r = await agent
      .post(`/api/admin/songs/${songId}/audio`)
      .field('x', '1') // at least one part so multipart
      .attach('file', Buffer.from('x'), { filename: 'a.mp3', contentType: 'image/png' })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('invalid_audio_type')
  })

  it('rejects over MAX_AUDIO_UPLOAD_MB', async () => {
    process.env.MAX_AUDIO_UPLOAD_MB = '1'
    const u = saUser()
    findUserByEmail.mockResolvedValue(u)
    findUserById.mockImplementation((id) => (id === saUid ? u : null))
    const big = Buffer.alloc(2 * 1024 * 1024, 0xff) // 2MB
    big[0] = 0x49
    big[1] = 0x44
    big[2] = 0x33
    const app = makeApp()
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: u.email, password: 'x' })
    const r = await agent
      .post(`/api/admin/songs/${songId}/audio`)
      .attach('file', big, { filename: 'x.mp3', contentType: 'audio/mpeg' })
    expect(r.status).toBe(413)
    expect(r.body.error).toBe('file_too_large')
  })

  it('saves valid MP3 metadata and bytes', async () => {
    const u = saUser()
    findUserByEmail.mockResolvedValue(u)
    findUserById.mockImplementation((id) => (id === saUid ? u : null))
    songsRepo.findSongById.mockResolvedValue(/** @type {any} */ (songOut))
    songsRepo.getSongStreamMeta.mockResolvedValue(
      /** @type {any} */ ({
        id: songId,
        status: 'draft',
        rightsStatus: 'licensed',
        storageKey: null,
        mime: null
      })
    )
    songsRepo.setSongAudioFields.mockImplementation(async () => songOut)

    const app = makeApp()
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: u.email, password: 'x' })
    const r = await agent
      .post(`/api/admin/songs/${songId}/audio`)
      .attach('file', mp3Id3, { filename: 't.mp3', contentType: 'audio/mpeg' })
    expect(r.status).toBe(201)
    expect(writeFile).toHaveBeenCalled()
    expect(songsRepo.setSongAudioFields).toHaveBeenCalled()
    const call = songsRepo.setSongAudioFields.mock.calls[0]
    expect(call[0]).toBe(songId)
    expect(call[1].audioMimeType).toBe('audio/mpeg')
    expect(call[1].audioFileUrl).toBe(`/api/songs/${songId}/audio`)
    expect(typeof call[1].audioStorageKey).toBe('string')
  })
})
