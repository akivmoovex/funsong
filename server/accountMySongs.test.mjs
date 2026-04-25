import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import * as usersRepo from './src/db/repos/usersRepo.mjs'
import * as favoriteRepo from './src/db/repos/userFavoriteSongsRepo.mjs'
import * as songsRepo from './src/db/repos/songsRepo.mjs'
import * as lyricRepo from './src/db/repos/lyricLinesRepo.mjs'
import { createApp } from './src/app.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  updateUserProfile: vi.fn(),
  updateUserPassword: vi.fn()
}))

vi.mock('./src/db/repos/userFavoriteSongsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return {
    ...m,
    listFavoriteSongs: vi.fn(),
    addFavoriteSong: vi.fn(),
    removeFavoriteSong: vi.fn(),
    isFavoriteSong: vi.fn()
  }
})

vi.mock('./src/db/repos/songsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, findSongById: vi.fn() }
})

vi.mock('./src/db/repos/lyricLinesRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, listLinesForSong: vi.fn() }
})

const { findUserByEmail, findUserById } = usersRepo
const { listFavoriteSongs, addFavoriteSong, removeFavoriteSong, isFavoriteSong } = favoriteRepo
const { findSongById } = songsRepo
const { listLinesForSong } = lyricRepo

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
}

async function loginHost(agent) {
  const r = await agent
    .post('/api/auth/login')
    .send({ email: 'host@example.com', password: 'goodpass123' })
  expect(r.status).toBe(200)
}

beforeEach(() => {
  vi.clearAllMocks()
  const user = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'host@example.com',
    display_name: 'Host User',
    role: 'host',
    is_active: true,
    password_hash: bcrypt.hashSync('goodpass123', 4)
  }
  findUserByEmail.mockResolvedValue(user)
  findUserById.mockResolvedValue(user)
  listFavoriteSongs.mockResolvedValue([
    {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Fav 1',
      difficulty: 'easy',
      tags: ['pop'],
      audioReady: true,
      lyricsReady: true
    }
  ])
  addFavoriteSong.mockResolvedValue({ user_id: user.id, song_id: '11111111-1111-4111-8111-111111111111' })
  removeFavoriteSong.mockResolvedValue(true)
  isFavoriteSong.mockResolvedValue(true)
  findSongById.mockResolvedValue({
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Fav 1',
    difficulty: 'easy',
    tags: ['pop'],
    audioFileUrl: '/api/songs/11111111-1111-4111-8111-111111111111/audio'
  })
  listLinesForSong.mockResolvedValue([
    { lineNumber: 0, textEnglish: 'Line 1' },
    { lineNumber: 1, textEnglish: 'Line 2' }
  ])
})

describe('account my songs API', () => {
  it('lists only current user favorites', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.get('/api/account/my-songs')
    expect(r.status).toBe(200)
    expect(r.body.songs).toHaveLength(1)
    expect(listFavoriteSongs).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', expect.anything())
  })

  it('adds favorite song', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post('/api/account/my-songs/11111111-1111-4111-8111-111111111111')
    expect(r.status).toBe(201)
    expect(r.body.added).toBe(true)
  })

  it('duplicate favorite does not duplicate', async () => {
    addFavoriteSong.mockResolvedValueOnce(null)
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post('/api/account/my-songs/11111111-1111-4111-8111-111111111111')
    expect(r.status).toBe(200)
    expect(r.body.added).toBe(false)
  })

  it('removes favorite song', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.delete('/api/account/my-songs/11111111-1111-4111-8111-111111111111')
    expect(r.status).toBe(200)
    expect(r.body.removed).toBe(true)
  })

  it('practice route loads favorite song payload', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.get('/api/account/my-songs/11111111-1111-4111-8111-111111111111/practice')
    expect(r.status).toBe(200)
    expect(r.body.song.title).toBe('Fav 1')
    expect(r.body.lines).toHaveLength(2)
  })

  it('practice route blocks non-favorite access', async () => {
    isFavoriteSong.mockResolvedValueOnce(false)
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.get('/api/account/my-songs/11111111-1111-4111-8111-111111111111/practice')
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('not_favorite')
  })
})
