import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import * as prRepo from './src/db/repos/partyRequestsRepo.mjs'
import * as sessRepo from './src/db/repos/partySessionsRepo.mjs'
import * as crRepo from './src/db/repos/controlRequestsRepo.mjs'
import { createApp } from './src/app.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn()
}))
vi.mock('./src/db/repos/partyRequestsRepo.mjs', () => ({
  findRequestByIdForHost: vi.fn()
}))
vi.mock('./src/db/repos/partySessionsRepo.mjs', () => ({
  findSessionById: vi.fn(),
  setCurrentControllerGuest: vi.fn()
}))
vi.mock('./src/db/repos/controlRequestsRepo.mjs', () => ({
  findById: vi.fn(),
  approveRequestById: vi.fn(),
  rejectOtherPendingForSession: vi.fn()
}))
vi.mock('./src/services/partyRealtime.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, emitControlAndPartyState: vi.fn() }
})

const { findRequestByIdForHost } = prRepo
const { findSessionById, setCurrentControllerGuest } = sessRepo
const { findById, approveRequestById, rejectOtherPendingForSession } = crRepo

const hostUid = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const prId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sid = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const reqCtrl = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10'
const g1 = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'
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
  await agent.post('/api/auth/login').send({ email: emailH, password: 'p' })
}

beforeEach(() => {
  vi.clearAllMocks()
  findById.mockResolvedValue({
    id: reqCtrl,
    session_id: sid,
    party_guest_id: g1,
    status: 'pending'
  })
  findSessionById.mockResolvedValue({
    id: sid,
    party_request_id: prId,
    status: 'active'
  })
  findRequestByIdForHost.mockResolvedValue({ id: prId, status: 'approved' })
  approveRequestById.mockResolvedValue({ id: reqCtrl, party_guest_id: g1 })
  setCurrentControllerGuest.mockResolvedValue({ id: sid })
  rejectOtherPendingForSession.mockResolvedValue(undefined)
})

/**
 * V1 #15: host approves control request
 */
describe('POST /api/host/control-requests/:requestId/approve', () => {
  it('returns 200 (scenario 15)', async () => {
    const app = makeApp()
    app.set('io', { to: () => ({ emit: vi.fn() }) })
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post(`/api/host/control-requests/${reqCtrl}/approve`).send({})
    expect(r.status).toBe(200)
    expect(r.body.ok).toBe(true)
    expect(approveRequestById).toHaveBeenCalled()
    expect(setCurrentControllerGuest).toHaveBeenCalledWith(
      sid,
      g1,
      expect.anything()
    )
  })
})
