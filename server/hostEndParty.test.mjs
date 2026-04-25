import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import * as partySessionsRepo from './src/db/repos/partySessionsRepo.mjs'
import { appendEvent } from './src/db/repos/partyEventsRepo.mjs'
import { emitHostPartyEnded } from './src/services/partyRealtime.mjs'
import { createApp } from './src/app.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn()
}))

vi.mock('./src/db/repos/partySessionsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, endPartySessionForHost: vi.fn() }
})

vi.mock('./src/db/repos/partyEventsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, appendEvent: vi.fn() }
})

vi.mock('./src/services/partyRealtime.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, emitHostPartyEnded: vi.fn() }
})

const { endPartySessionForHost } = partySessionsRepo

const hostUid = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const prId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sid = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const otherHostUid = '99999999-9999-4999-8999-999999999999'
const emailH = 'h@e.re'
const emailO = 'o@e.re'

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
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
  findUserById.mockImplementation((id) => (id === hostUid ? Promise.resolve(h) : null))
  const r = await agent.post('/api/auth/login').send({ email: emailH, password: 'p' })
  expect(r.status).toBe(200)
}

async function loginOtherHost(agent) {
  const h = {
    id: otherHostUid,
    email: emailO,
    display_name: 'o',
    role: 'host',
    is_active: true,
    password_hash: bcrypt.hashSync('o', 4)
  }
  findUserByEmail.mockResolvedValue(h)
  findUserById.mockImplementation((id) => (id === otherHostUid ? Promise.resolve(h) : null))
  const r = await agent.post('/api/auth/login').send({ email: emailO, password: 'o' })
  expect(r.status).toBe(200)
}

beforeEach(() => {
  vi.clearAllMocks()
  endPartySessionForHost.mockResolvedValue({
    ok: true,
    session: { id: sid, status: 'ended' }
  })
})

describe('POST /api/host/parties/:partyId/end-party', () => {
  it('ends party for the owning host and logs + broadcasts', async () => {
    const app = makeApp()
    app.set('io', { to: vi.fn().mockReturnValue({ emit: vi.fn() }) })
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post(`/api/host/parties/${prId}/end-party`).send({})
    expect(r.status).toBe(200)
    expect(r.body.ok).toBe(true)
    expect(r.body.session?.status).toBe('ended')
    expect(endPartySessionForHost).toHaveBeenCalledWith(prId, hostUid, expect.anything())
    expect(appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: sid,
        eventType: 'party_ended',
        payload: expect.objectContaining({ source: 'host' })
      }),
      expect.anything()
    )
    expect(emitHostPartyEnded).toHaveBeenCalled()
  })

  it('returns 404 when the host does not own the party (wrong host id)', async () => {
    endPartySessionForHost.mockResolvedValueOnce({ ok: false, error: 'not_found' })
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post(`/api/host/parties/${prId}/end-party`).send({})
    expect(r.status).toBe(404)
    expect(r.body.error).toBe('not_found')
  })

  it('returns 404 when another host tries to end a party they do not own', async () => {
    endPartySessionForHost.mockResolvedValueOnce({ ok: false, error: 'not_found' })
    const app = makeApp()
    const agent = request.agent(app)
    await loginOtherHost(agent)
    const r = await agent.post(`/api/host/parties/${prId}/end-party`).send({})
    expect(r.status).toBe(404)
    expect(r.body.error).toBe('not_found')
  })

  it('returns 401 when not logged in', async () => {
    const app = makeApp()
    const r = await request(app).post(`/api/host/parties/${prId}/end-party`).send({})
    expect(r.status).toBe(401)
    expect(endPartySessionForHost).not.toHaveBeenCalled()
  })
})
