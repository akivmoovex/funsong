import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import session from 'express-session'
import { createApp } from './src/app.mjs'
import * as guestJoin from './src/services/guestJoin.mjs'
import * as partyGuests from './src/db/repos/partyGuestsRepo.mjs'
import * as partySessions from './src/db/repos/partySessionsRepo.mjs'
import * as partyRealtime from './src/services/partyRealtime.mjs'

vi.mock('./src/services/guestJoin.mjs', () => ({
  getJoinPreview: vi.fn(),
  performGuestJoin: vi.fn()
}))

vi.mock('./src/db/repos/partyGuestsRepo.mjs', () => ({
  findGuestById: vi.fn(),
  listGuestsBySessionId: vi.fn(),
  createGuest: vi.fn(),
  countConnectedGuestsBySessionId: vi.fn(),
  findGuestByTokenForPartyCode: vi.fn(),
  updatePartyGuestConnectionState: vi.fn()
}))

vi.mock('./src/db/repos/partySessionsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return {
    ...m,
    findSessionByPartyCode: vi.fn(),
    setCurrentControllerGuest: vi.fn()
  }
})

vi.mock('./src/services/partyRealtime.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return {
    ...m,
    emitControlAndPartyState: vi.fn(),
    emitPartyGuestsUpdated: vi.fn()
  }
})

const { getJoinPreview, performGuestJoin } = guestJoin
const { findGuestByTokenForPartyCode, updatePartyGuestConnectionState } = partyGuests
const { findSessionByPartyCode, setCurrentControllerGuest } = partySessions
const { emitControlAndPartyState, emitPartyGuestsUpdated } = partyRealtime

const code = 'JoinCode01'

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  findSessionByPartyCode.mockResolvedValue({
    id: 's1',
    status: 'active',
    current_controller_party_guest_id: null
  })
  findGuestByTokenForPartyCode.mockResolvedValue({
    id: 'g1',
    display_name: 'Bob',
    language_preference: 'english',
    session_pk: 's1',
    session_status: 'active',
    max_guests: 30
  })
  updatePartyGuestConnectionState.mockResolvedValue({ id: 'g1', is_connected: false })
  setCurrentControllerGuest.mockResolvedValue({ id: 's1', current_controller_party_guest_id: null })
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
    const app = makeApp()
    const r = await request(app)
      .get(`/api/party/${code}`)
      .set('Cookie', ['fs_guest=abc123def'])
    expect(r.status).toBe(200)
    expect(r.body.guest?.displayName).toBe('Bob')
  })

  it('POST /api/party/:code/leave marks guest disconnected and clears cookie', async () => {
    const app = makeApp()
    app.set('io', { to: () => ({ emit: vi.fn() }) })
    const r = await request(app)
      .post(`/api/party/${code}/leave`)
      .set('Cookie', ['fs_guest=abc123def'])
      .send({})
    expect(r.status).toBe(200)
    expect(r.body.ok).toBe(true)
    expect(updatePartyGuestConnectionState).toHaveBeenCalledWith('g1', { isConnected: false }, expect.anything())
    const setCookie = String((r.headers['set-cookie'] || [])[0] || '')
    expect(setCookie).toContain('fs_guest=')
    expect(setCookie).toContain('Max-Age=0')
    expect(emitPartyGuestsUpdated).toHaveBeenCalled()
  })

  it('leave clears controller when leaving guest is current controller', async () => {
    findSessionByPartyCode.mockResolvedValue({
      id: 's1',
      status: 'active',
      current_controller_party_guest_id: 'g1'
    })
    const app = makeApp()
    app.set('io', { to: () => ({ emit: vi.fn() }) })
    const r = await request(app)
      .post(`/api/party/${code}/leave`)
      .set('Cookie', ['fs_guest=abc123def'])
      .send({})
    expect(r.status).toBe(200)
    expect(setCurrentControllerGuest).toHaveBeenCalledWith('s1', null, expect.anything())
    expect(emitControlAndPartyState).toHaveBeenCalled()
  })

  it('left guest cookie no longer authenticates control endpoints', async () => {
    const app = makeApp()
    const leave = await request(app)
      .post(`/api/party/${code}/leave`)
      .set('Cookie', ['fs_guest=abc123def'])
      .send({})
    expect(leave.status).toBe(200)
    const reqCtl = await request(app)
      .post(`/api/party/${code}/request-control`)
      .send({})
    expect(reqCtl.status).toBe(401)
  })
})
