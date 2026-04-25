import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import * as partyRequestsRepo from './src/db/repos/partyRequestsRepo.mjs'
import * as partySessionsRepo from './src/db/repos/partySessionsRepo.mjs'
import * as partyRequestApproval from './src/services/partyRequestApproval.mjs'
import * as appSettingsService from './src/services/appSettingsService.mjs'
import { createApp } from './src/app.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn()
}))

vi.mock('./src/db/repos/partyRequestsRepo.mjs', () => ({
  createRequest: vi.fn(),
  findRequestById: vi.fn(),
  listRequestsByHostId: vi.fn(),
  findRequestByIdForHost: vi.fn(),
  listPendingRequestsForAdmin: vi.fn()
}))

vi.mock('./src/db/repos/partySessionsRepo.mjs', () => ({
  findSessionById: vi.fn(),
  findSessionByPartyRequestId: vi.fn(),
  createSession: vi.fn()
}))

vi.mock('./src/services/partyRequestApproval.mjs', () => ({
  approvePartyRequest: vi.fn(),
  rejectPartyRequest: vi.fn()
}))

vi.mock('./src/services/appSettingsService.mjs', () => ({
  getIntSetting: vi.fn()
}))

const { createRequest, findRequestById, listRequestsByHostId, findRequestByIdForHost } = partyRequestsRepo
const { findSessionByPartyRequestId } = partySessionsRepo
const { approvePartyRequest } = partyRequestApproval
const { getIntSetting } = appSettingsService

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
    updated_at: new Date('2030-01-01T00:00:00.000Z'),
    location: 'Indoor'
  }
  approvePartyRequest.mockResolvedValue({
    ok: true,
    session: {
      id: 'ssssssss-ssss-4sss-8sss-ssssssssssss',
      party_code: 'AUTO-CODE1',
      max_guests: 30
    },
    closedSessionIds: []
  })
  getIntSetting.mockResolvedValue(30)
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
  it('host creates a party that is approved immediately', async () => {
    const before = Date.now()
    createRequest.mockImplementation(async (o) => {
      expect(o.hostId).toBe(hostUidA)
      expect(o.partyName).toBe('My bash')
      expect(o.expectedGuests).toBe(30)
      expect(o.location).toBe('Rooftop')
      expect(o.eventDatetime).toBeInstanceOf(Date)
      expect(o.eventDatetime.getTime()).toBeGreaterThanOrEqual(before - 2_000)
      expect(o.eventDatetime.getTime()).toBeLessThanOrEqual(Date.now() + 2_000)
      return { ...partyRowPending, party_name: o.partyName, expected_guests: o.expectedGuests, location: o.location }
    })
    findRequestById.mockResolvedValue({
      ...partyRowPending,
      status: 'approved',
      party_name: 'My bash',
      expected_guests: 30,
      location: 'Rooftop'
    })
    findSessionByPartyRequestId.mockResolvedValue({
      join_code: 'AUTO-CODE1',
      party_code: 'AUTO-CODE1',
      status: 'approved'
    })

    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const r = await agent.post('/api/host/parties/request').send({
      partyName: 'My bash',
      location: 'Rooftop',
      privateUseConfirmed: true
    })
    expect(r.status).toBe(201)
    expect(r.body.partyRequest).toBeDefined()
    expect(r.body.partyRequest.status).toBe('approved')
    expect(r.body.partyRequest.canShowJoinLink).toBe(true)
    expect(r.body.partyRequest.joinPath).toBe('/join/AUTO-CODE1')
    expect(approvePartyRequest).toHaveBeenCalledWith(expect.anything(), prIdA, hostUidA)
  })

  it('host create uses max_party_guests setting for expectedGuests', async () => {
    getIntSetting.mockResolvedValueOnce(42)
    createRequest.mockImplementation(async (o) => {
      expect(o.expectedGuests).toBe(42)
      return { ...partyRowPending, party_name: o.partyName, expected_guests: o.expectedGuests, location: o.location }
    })
    findRequestById.mockResolvedValue({
      ...partyRowPending,
      status: 'approved',
      expected_guests: 42
    })
    findSessionByPartyRequestId.mockResolvedValue({
      join_code: 'AUTO-CODE1',
      party_code: 'AUTO-CODE1',
      status: 'approved'
    })
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const r = await agent.post('/api/host/parties/request').send({
      partyName: 'Settings cap party',
      location: 'Rooftop',
      privateUseConfirmed: true
    })
    expect(r.status).toBe(201)
    expect(getIntSetting).toHaveBeenCalledWith('max_party_guests', 30, expect.anything())
  })

  it('rejects create without private use confirmation (400)', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const r = await agent.post('/api/host/parties/request').send({
      partyName: 'X',
      location: 'Home',
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
      .send({ partyName: 'x', location: 'Home' })
    expect(r.status).toBe(401)
    expect(createRequest).not.toHaveBeenCalled()
  })

  it('rejects create without required location (400)', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const r = await agent.post('/api/host/parties/request').send({
      partyName: 'No location',
      privateUseConfirmed: true
    })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('location_required')
    expect(createRequest).not.toHaveBeenCalled()
  })

  it('rejects create without party name (400)', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const r = await agent.post('/api/host/parties/request').send({
      location: 'Home',
      privateUseConfirmed: true
    })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('party_name_required')
  })

  it('create succeeds without event datetime in body; uses server time', async () => {
    const before = Date.now()
    createRequest.mockImplementation(async (o) => {
      expect(o.eventDatetime).toBeInstanceOf(Date)
      expect(o.eventDatetime.getTime()).toBeGreaterThanOrEqual(before - 2_000)
      expect(o.eventDatetime.getTime()).toBeLessThanOrEqual(Date.now() + 2_000)
      return { ...partyRowPending, party_name: o.partyName, location: o.location }
    })
    findRequestById.mockResolvedValue({
      ...partyRowPending,
      status: 'approved',
      party_name: 'No date in body',
      location: 'Home'
    })
    findSessionByPartyRequestId.mockResolvedValue({
      join_code: 'AUTO-CODE1',
      party_code: 'AUTO-CODE1',
      status: 'approved'
    })
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const r = await agent.post('/api/host/parties/request').send({
      partyName: 'No date in body',
      location: 'Home',
      privateUseConfirmed: true
    })
    expect(r.status).toBe(201)
    expect(createRequest).toHaveBeenCalled()
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

  it('newly created party has QR/join payload immediately', async () => {
    createRequest.mockResolvedValue({
      ...partyRowPending,
      status: 'pending',
      party_name: 'QR now',
      expected_guests: 30,
      location: 'Lounge'
    })
    findRequestById.mockResolvedValue({
      ...partyRowPending,
      status: 'approved',
      party_name: 'QR now',
      expected_guests: 30,
      location: 'Lounge'
    })
    findSessionByPartyRequestId.mockResolvedValue({
      id: 'sess-1',
      join_code: 'NOW-QR-01',
      party_code: 'NOW-QR-01',
      status: 'approved'
    })
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const created = await agent.post('/api/host/parties/request').send({
      partyName: 'QR now',
      location: 'Lounge',
      privateUseConfirmed: true
    })
    expect(created.status).toBe(201)
    const id = created.body.partyRequest?.id
    const qr = await agent
      .get(`/api/host/parties/${id}/qr`)
      .query({ format: 'json' })
      .set('Host', 'example.com')
    expect(qr.status).toBe(200)
    expect(qr.body.joinPath).toBe('/join/NOW-QR-01')
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

  it('status endpoint returns pending with no redirect', async () => {
    findRequestByIdForHost.mockResolvedValue({
      ...partyRowPending,
      status: 'pending'
    })
    findSessionByPartyRequestId.mockResolvedValue(null)
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const r = await agent.get(`/api/host/party-requests/${prIdA}/status`)
    expect(r.status).toBe(200)
    expect(r.body.request?.status).toBe('pending')
    expect(r.body.request?.partyName).toBe('Test party')
    expect(r.body.request?.redirectPath).toBeNull()
  })

  it('status endpoint returns approved with qr redirect target', async () => {
    findRequestByIdForHost.mockResolvedValue({
      ...partyRowPending,
      status: 'approved'
    })
    findSessionByPartyRequestId.mockResolvedValue({
      join_code: 'APPROVED-1',
      party_code: 'APPROVED-1',
      status: 'approved'
    })
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const r = await agent.get(`/api/host/party-requests/${prIdA}/status`)
    expect(r.status).toBe(200)
    expect(r.body.request?.status).toBe('approved')
    expect(r.body.request?.redirectPath).toBe(`/host/parties/${prIdA}/qr`)
    expect(r.body.request?.canShowQr).toBe(true)
  })

  it('status endpoint returns rejected with rejection reason', async () => {
    findRequestByIdForHost.mockResolvedValue({
      ...partyRowPending,
      status: 'rejected',
      rejection_reason: 'Missing details'
    })
    findSessionByPartyRequestId.mockResolvedValue(null)
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    const r = await agent.get(`/api/host/party-requests/${prIdA}/status`)
    expect(r.status).toBe(200)
    expect(r.body.request?.status).toBe('rejected')
    expect(r.body.request?.rejectionReason).toBe('Missing details')
    expect(r.body.request?.redirectPath).toBe(`/host/parties/${prIdA}`)
  })

  it('status endpoint does not expose another host request', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent, hostUidA, emailA)
    findRequestByIdForHost.mockResolvedValue(null)
    const r = await agent.get(`/api/host/party-requests/${prIdA}/status`)
    expect(r.status).toBe(404)
  })
})
