import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import * as prRepo from './src/db/repos/partyRequestsRepo.mjs'
import * as sessRepo from './src/db/repos/partySessionsRepo.mjs'
import * as crRepo from './src/db/repos/controlRequestsRepo.mjs'
import * as partyEventsRepo from './src/db/repos/partyEventsRepo.mjs'
import { createApp } from './src/app.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn()
}))
vi.mock('./src/db/repos/partyRequestsRepo.mjs', () => ({
  findRequestByIdForHost: vi.fn()
}))
vi.mock('./src/db/repos/partySessionsRepo.mjs', () => ({
  findSessionByPartyRequestId: vi.fn(),
  setCurrentControllerGuest: vi.fn()
}))
vi.mock('./src/db/repos/controlRequestsRepo.mjs', () => ({
  rejectAllPendingForSession: vi.fn()
}))
vi.mock('./src/db/repos/partyEventsRepo.mjs', () => ({
  appendEvent: vi.fn()
}))
vi.mock('./src/services/partyRealtime.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, emitControlAndPartyState: vi.fn() }
})

const { findRequestByIdForHost } = prRepo
const { findSessionByPartyRequestId, setCurrentControllerGuest } = sessRepo
const { rejectAllPendingForSession } = crRepo
const { appendEvent } = partyEventsRepo

const hostUid = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const prId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sid = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const gCtrl = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'
const emailH = 'h@e.re'

function makeApp() {
  const c = {
    query: vi.fn().mockImplementation(async (q) => {
      if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
        return { rows: [] }
      }
      return { rows: [] }
    }),
    release: vi.fn()
  }
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ connect: () => Promise.resolve(c) })
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

beforeEach(() => {
  vi.clearAllMocks()
  findRequestByIdForHost.mockResolvedValue({ id: prId, status: 'approved' })
  findSessionByPartyRequestId.mockResolvedValue({
    id: sid,
    party_request_id: prId,
    status: 'active',
    current_controller_party_guest_id: gCtrl
  })
  setCurrentControllerGuest.mockResolvedValue({ id: sid })
  rejectAllPendingForSession.mockResolvedValue(undefined)
  appendEvent.mockResolvedValue({ id: 'evt1' })
})

/**
 * V1 #19: host takes back control (revoke guest controller)
 */
describe('POST /api/host/parties/:partyId/take-control', () => {
  it('succeeds and clears controller (scenario 19)', async () => {
    const app = makeApp()
    app.set('io', { to: () => ({ emit: vi.fn() }) })
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post(`/api/host/parties/${prId}/take-control`).send({})
    expect(r.status).toBe(200)
    expect(r.body.ok).toBe(true)
    expect(setCurrentControllerGuest).toHaveBeenCalledWith(sid, null, expect.anything())
    expect(rejectAllPendingForSession).toHaveBeenCalled()
    expect(appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: sid,
        eventType: 'control_taken_back'
      }),
      expect.anything()
    )
  })

  it('rejects non-host caller', async () => {
    const app = makeApp()
    const r = await request(app).post(`/api/host/parties/${prId}/take-control`).send({})
    expect(r.status).toBe(401)
  })
})
