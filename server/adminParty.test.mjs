import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import { createApp } from './src/app.mjs'
import * as prRepo from './src/db/repos/partyRequestsRepo.mjs'
import * as approval from './src/services/partyRequestApproval.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  createUser: vi.fn(),
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
  createSession: vi.fn(),
  findSessionByPartyCode: vi.fn(),
  listSessionsForAdmin: vi.fn(),
  disableSessionById: vi.fn()
}))

vi.mock('./src/services/partyRequestApproval.mjs', () => ({
  approvePartyRequest: vi.fn(),
  rejectPartyRequest: vi.fn()
}))

const saUid = '1a2b3c4d-1a2b-1a2b-1a2b-123456789abc'
const hostUid = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const prId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const emailSa = 's@a.dm'
const emailH = 'h@e.re'

const { listPendingRequestsForAdmin } = prRepo
const { approvePartyRequest, rejectPartyRequest } = approval

function makeUser(role) {
  const h = bcrypt.hashSync('goodpass', 4)
  return {
    id: role === 'super_admin' ? saUid : hostUid,
    email: role === 'super_admin' ? emailSa : emailH,
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

async function loginAs(agent, role) {
  const u = makeUser(role)
  findUserByEmail.mockResolvedValue(u)
  findUserById.mockImplementation((id) => (id === u.id ? Promise.resolve(u) : null))
  const r = await agent
    .post('/api/auth/login')
    .send({ email: u.email, password: 'goodpass' })
  expect(r.status).toBe(200)
}

beforeEach(() => {
  vi.clearAllMocks()
  listPendingRequestsForAdmin.mockResolvedValue([])
  approvePartyRequest.mockResolvedValue({
    ok: true,
    session: {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      party_code: 'testParty1',
      max_guests: 30
    }
  })
  rejectPartyRequest.mockResolvedValue({
    ok: true,
    request: { id: prId }
  })
})

describe('admin party approval API', () => {
  it('POST approve creates session (201)', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginAs(agent, 'super_admin')
    const r = await agent
      .post(`/api/admin/party-requests/${prId}/approve`)
      .send({})
    expect(r.status).toBe(201)
    expect(r.body.session?.partyCode).toBe('testParty1')
    expect(approvePartyRequest).toHaveBeenCalled()
  })

  it('rejection stores reason via service', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginAs(agent, 'super_admin')
    const r = await agent.post(`/api/admin/party-requests/${prId}/reject`).send({
      reason: '  Outside service area  '
    })
    expect(r.status).toBe(200)
    expect(rejectPartyRequest).toHaveBeenCalledWith(
      expect.anything(),
      prId,
      '  Outside service area  ',
      saUid
    )
  })

  it('host cannot approve', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginAs(agent, 'host')
    const r = await agent
      .post(`/api/admin/party-requests/${prId}/approve`)
      .send({})
    expect(r.status).toBe(403)
    expect(approvePartyRequest).not.toHaveBeenCalled()
  })
})
