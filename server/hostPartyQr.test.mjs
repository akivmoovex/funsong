import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import { findRequestByIdForHost } from './src/db/repos/partyRequestsRepo.mjs'
import { findSessionByPartyRequestId } from './src/db/repos/partySessionsRepo.mjs'
import { createApp } from './src/app.mjs'

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

vi.mock('qrcode', () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from([137, 80, 78, 71]))
  }
}))

const prIdA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const hostUidA = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const emailA = 'h@e.re'

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
}

async function loginHost(agent) {
  const h = {
    id: hostUidA,
    email: emailA,
    display_name: 'host',
    role: 'host',
    is_active: true,
    password_hash: bcrypt.hashSync('goodpass', 4)
  }
  findUserByEmail.mockResolvedValue(h)
  findUserById.mockImplementation((id) => (id === hostUidA ? Promise.resolve(h) : null))
  const r = await agent.post('/api/auth/login').send({ email: emailA, password: 'goodpass' })
  expect(r.status).toBe(200)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('host party QR', () => {
  it('QR is unavailable (404) before approval', async () => {
    findRequestByIdForHost.mockResolvedValue({
      id: prIdA,
      status: 'pending',
      host_id: hostUidA
    })
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent
      .get(`/api/host/parties/${prIdA}/qr`)
      .query({ format: 'json' })
    expect(r.status).toBe(404)
  })

  it('QR is available after approval with session code (json)', async () => {
    findRequestByIdForHost.mockResolvedValue({
      id: prIdA,
      status: 'approved',
      host_id: hostUidA
    })
    findSessionByPartyRequestId.mockResolvedValue({
      id: 'sess',
      status: 'approved',
      party_code: 'ZetaCode99',
      join_code: 'ZetaCode99'
    })
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent
      .get(`/api/host/parties/${prIdA}/qr`)
      .query({ format: 'json' })
      .set('Host', 'example.com')
    expect(r.status).toBe(200)
    expect(r.body.partyCode).toBe('ZetaCode99')
    expect(r.body.joinPath).toBe('/join/ZetaCode99')
  })
})
