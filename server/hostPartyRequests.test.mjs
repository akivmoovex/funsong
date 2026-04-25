import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import * as partyRequestsRepo from './src/db/repos/partyRequestsRepo.mjs'
import * as partySessionsRepo from './src/db/repos/partySessionsRepo.mjs'
import { createApp } from './src/app.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
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
  createSession: vi.fn()
}))

const { createRequest, listRequestsByHostId, findRequestByIdForHost } = partyRequestsRepo
const { findSessionByPartyRequestId } = partySessionsRepo

const hostUidA = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const hostUidB = '2c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0e'
const prIdA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const emailA = 'h@e.re'
const emailB = 'h2@e.re'

function makeUser(id, email) {
  return {
    id,
    email,
    display_name: 'host',
    role: 'host',
    is_active: true,
    password_hash: bcrypt.hashSync('goodpass', 4)
  }
}

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
}

let partyRowPending

beforeEach(() => {
  vi.clearAllMocks()
  const eventIso = '2030-06-01T18:00:00.000Z'
  partyRowPending = {
    id: prIdA,
    host_id: hostUidA,
    status: 'pending',
    party_name: 'Test party',
    event_datetime: new Date(eventIso),
    expected_guests: 20,
    description: 'd',
    private_use_confirmed: true,
    private_use_confirmed_at: new Date('2030-01-01T00:00:00.000Z'),
    rejection_reason: null,
    message: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: new Date('2030-01-01T00:00:00.000Z'),
    updated_at: new Date('2030-01-01T00:00:00.000Z')
  }
})

async function loginHost(agent, uid, email) {
  const h = makeUser(uid, email)
  findUserByEmail.mockResolvedValue(h)
  findUserById.mockImplementation((id) => (id === uid ? Promise.resolve(h) : Promise.resolve(null)))
  const r = await agent.post('/api/auth/login').send({ email, password: 'goodpass' })
  expect(r.status).toBe(200)
  return h
}

describe('host party requests API', () => {
  it('host can create a pending request', async () => {
    createRequest.mockImplementation(async (o) => {
      expect(o.hostId).toBe(hostUidA)
      expect(o.partyName).toBe('My bash')
      expect(o.expectedGuests).toBe(25)
      return { ...partyRowPending, party_name: o.partyName, expected_guests: o.expectedGuests }
    })
    findSessionByPartyRequestId.mockResolvedValue(null)

    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const r = await agent.post('/api/host/parties/request').send({
      partyName: 'My bash',
      eventDatetime: '2030-07-15T12:00:00.000Z',
      expectedGuests: 25,
      description: 'indoor',
      privateUseConfirmed: true
    })
    expect(r.status).toBe(201)
    expect(r.body.partyRequest).toBeDefined()
    expect(r.body.partyRequest.status).toBe('pending')
    expect(r.body.partyRequest.canShowJoinLink).toBe(false)
    expect(r.body.partyRequest.joinUrl).toBeNull()
    expect(r.body.partyRequest.joinPath).toBeNull()
  })

  it('rejects create without private use confirmation (400)', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const r = await agent.post('/api/host/parties/request').send({
      partyName: 'X',
      eventDatetime: '2030-07-15T12:00:00.000Z',
      expectedGuests: 10,
      privateUseConfirmed: false
    })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('private_use_confirmation_required')
    expect(createRequest).not.toHaveBeenCalled()
  })

  it('unauthenticated user cannot create a request', async () => {
    const app = makeApp()
    const r = await request(app)
      .post('/api/host/parties/request')
      .send({ partyName: 'x', eventDatetime: '2030-01-01T00:00:00.000Z', expectedGuests: 10 })
    expect(r.status).toBe(401)
    expect(createRequest).not.toHaveBeenCalled()
  })

  it('host cannot load another host party request', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    findRequestByIdForHost.mockResolvedValue(null)
    const r = await agent.get(`/api/host/party-requests/${prIdA}`)
    expect(r.status).toBe(404)
  })

  it('pending request has no join link or join path in detail response', async () => {
    findRequestByIdForHost.mockResolvedValue(partyRowPending)
    findSessionByPartyRequestId.mockResolvedValue(null)
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const r = await agent.get(`/api/host/party-requests/${prIdA}`)
    expect(r.status).toBe(200)
    expect(r.body.partyRequest?.status).toBe('pending')
    expect(r.body.partyRequest?.canShowJoinLink).toBe(false)
    expect(r.body.partyRequest?.canShowQr).toBe(false)
    expect(r.body.partyRequest?.joinUrl).toBeNull()
    expect(r.body.partyRequest?.joinPath).toBeNull()
  })

  it('approved with session party_code returns joinPath /join/:code and canShow join + qr', async () => {
    const row = { ...partyRowPending, status: 'approved' }
    findRequestByIdForHost.mockResolvedValue(row)
    findSessionByPartyRequestId.mockResolvedValue({
      join_code: 'ABC-123',
      party_code: 'ABC-123',
      status: 'approved'
    })
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const r = await agent.get(`/api/host/party-requests/${prIdA}`)
    expect(r.status).toBe(200)
    expect(r.body.partyRequest?.status).toBe('approved')
    expect(r.body.partyRequest?.canShowJoinLink).toBe(true)
    expect(r.body.partyRequest?.canShowQr).toBe(true)
    expect(r.body.partyRequest?.joinPath).toBe('/join/ABC-123')
  })

  it('second host only sees their own list scope via repo (smoke: list is called with own id)', async () => {
    listRequestsByHostId.mockResolvedValue([partyRowPending])
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidB, emailB)
    const r = await agent.get('/api/host/party-requests')
    expect(r.status).toBe(200)
    expect(listRequestsByHostId).toHaveBeenCalledWith(hostUidB, expect.anything())
  })
})
