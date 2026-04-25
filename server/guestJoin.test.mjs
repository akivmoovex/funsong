import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import session from 'express-session'
import { createApp } from './src/app.mjs'
import * as guestJoin from './src/services/guestJoin.mjs'
import * as partyGuests from './src/db/repos/partyGuestsRepo.mjs'

vi.mock('./src/services/guestJoin.mjs', () => ({
  getJoinPreview: vi.fn(),
  performGuestJoin: vi.fn()
}))

vi.mock('./src/db/repos/partyGuestsRepo.mjs', () => ({
  findGuestById: vi.fn(),
  listGuestsBySessionId: vi.fn(),
  createGuest: vi.fn(),
  countConnectedGuestsBySessionId: vi.fn(),
  findGuestByTokenForPartyCode: vi.fn()
}))

const { getJoinPreview, performGuestJoin } = guestJoin
const { findGuestByTokenForPartyCode } = partyGuests

const code = 'JoinCode01'

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('guest join API', () => {
  it('guest can join approved party (201, sets cookie, redirect)', async () => {
    getJoinPreview.mockResolvedValue({
      found: true,
      canJoin: true,
      full: false,
      reason: null,
      status: 'approved',
      partyTitle: 'Test',
      currentGuests: 0,
      maxGuests: 30
    })
    performGuestJoin.mockResolvedValue({
      ok: true,
      session: { id: 's1' },
      guest: { id: 'g1', display_name: 'Ann' }
    })
    const app = makeApp()
    const r = await request(app)
      .post(`/api/join/${code}`)
      .send({ displayName: ' Ann ', language: 'english' })
    expect(r.status).toBe(201)
    expect(r.body.redirect).toBe(`/party/${code}`)
    expect(r.body.guest?.displayName).toBe('Ann')
    const set = r.headers['set-cookie']
    const hasFs = Array.isArray(set) ? set.some((c) => c.startsWith('fs_guest=')) : false
    expect(hasFs).toBe(true)
  })

  it('guest can join newly created auto-approved party code', async () => {
    getJoinPreview.mockResolvedValue({
      found: true,
      canJoin: true,
      full: false,
      reason: null,
      status: 'approved',
      partyTitle: 'New Party',
      currentGuests: 0,
      maxGuests: 30
    })
    performGuestJoin.mockResolvedValue({
      ok: true,
      session: { id: 's2' },
      guest: { id: 'g2', display_name: 'Rina' }
    })
    const app = makeApp()
    const r = await request(app)
      .post('/api/join/NOW-QR-01')
      .send({ displayName: 'Rina', language: 'english' })
    expect(r.status).toBe(201)
    expect(r.body.redirect).toBe('/party/NOW-QR-01')
    expect(r.body.guest?.displayName).toBe('Rina')
  })

  it('cannot join disabled party (403)', async () => {
    performGuestJoin.mockResolvedValue({ ok: false, error: 'not_joinable' })
    const app = makeApp()
    const r = await request(app)
      .post(`/api/join/${code}`)
      .send({ displayName: 'X', language: 'english' })
    expect(r.status).toBe(403)
  })

  it('cannot join ended party (403)', async () => {
    performGuestJoin.mockResolvedValue({ ok: false, error: 'not_joinable' })
    const app = makeApp()
    const r = await request(app)
      .post(`/api/join/${code}`)
      .send({ displayName: 'X', language: 'hindi' })
    expect(r.status).toBe(403)
  })

  it('31st guest blocked (409)', async () => {
    performGuestJoin.mockResolvedValue({ ok: false, error: 'full' })
    const app = makeApp()
    const r = await request(app)
      .post(`/api/join/${code}`)
      .send({ displayName: 'X', language: 'hebrew' })
    expect(r.status).toBe(409)
  })

  it('invalid language (400)', async () => {
    performGuestJoin.mockResolvedValue({ ok: false, error: 'invalid_language' })
    const app = makeApp()
    const r = await request(app)
      .post(`/api/join/${code}`)
      .send({ displayName: 'X', language: 'klingon' })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('invalid_language')
  })

  it('GET preview 404 for unknown code', async () => {
    getJoinPreview.mockResolvedValue({ found: false })
    const app = makeApp()
    const r = await request(app).get('/api/join/unknowncode99')
    expect(r.status).toBe(404)
  })

  it('GET /api/party with valid cookie', async () => {
    findGuestByTokenForPartyCode.mockResolvedValue({
      id: 'g1',
      display_name: 'Bob',
      language_preference: 'english',
      session_pk: 's1',
      session_status: 'active',
      max_guests: 30
    })
    const app = makeApp()
    const r = await request(app)
      .get(`/api/party/${code}`)
      .set('Cookie', ['fs_guest=abc123def'])
    expect(r.status).toBe(200)
    expect(r.body.guest?.displayName).toBe('Bob')
  })
})
