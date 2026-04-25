import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import { createApp } from './src/app.mjs'
import * as partySessionsRepo from './src/db/repos/partySessionsRepo.mjs'
import { appendEvent } from './src/db/repos/partyEventsRepo.mjs'
import { emitAdminPartyDisabled } from './src/services/partyRealtime.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn()
}))

vi.mock('./src/db/repos/partySessionsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return {
    ...m,
    listSessionsForAdmin: vi.fn(),
    findSessionRowForAdminById: vi.fn(),
    disableSessionById: vi.fn()
  }
})

vi.mock('./src/db/repos/partyEventsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return {
    ...m,
    appendEvent: vi.fn()
  }
})

vi.mock('./src/services/partyRealtime.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return {
    ...m,
    emitAdminPartyDisabled: vi.fn()
  }
})

const saUid = '1a2b3c4d-1a2b-1a2b-1a2b-123456789abc'
const emailSa = 's@a.dm'
const sid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function makeUser() {
  return {
    id: saUid,
    email: emailSa,
    display_name: 'admin',
    role: 'super_admin',
    is_active: true,
    password_hash: bcrypt.hashSync('goodpass', 4)
  }
}

function sampleListRow() {
  return {
    id: sid,
    party_request_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    host_id: '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d',
    status: 'active',
    max_guests: 25,
    party_code: 'TEST12',
    request_party_name: 'Big bash',
    request_status: 'approved',
    host_email: 'h@e.re',
    host_display_name: 'Hosty',
    created_at: new Date('2030-01-02T00:00:00.000Z'),
    active_song_id: '11111111-1111-4111-8111-111111111111',
    active_song_title: 'Karaoke Hit',
    current_controller_party_guest_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    connected_guests: 3,
    controller_guest_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    controller_display_name: 'Alex'
  }
}

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
}

async function loginSuperAdmin(agent) {
  const u = makeUser()
  findUserByEmail.mockResolvedValue(u)
  findUserById.mockImplementation((id) => (id === saUid ? Promise.resolve(u) : null))
  const r = await agent.post('/api/auth/login').send({ email: emailSa, password: 'goodpass' })
  expect(r.status).toBe(200)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('admin party monitor API', () => {
  it('GET /api/admin/parties returns live parties for super admin', async () => {
    partySessionsRepo.listSessionsForAdmin.mockResolvedValue([sampleListRow()])
    const app = makeApp()
    const agent = request.agent(app)
    await loginSuperAdmin(agent)
    const r = await agent.get('/api/admin/parties')
    expect(r.status).toBe(200)
    expect(r.body.parties).toHaveLength(1)
    const p = r.body.parties[0]
    expect(p.partyName).toBe('Big bash')
    expect(p.connectedGuestCount).toBe(3)
    expect(p.maxGuests).toBe(25)
    expect(p.activeSong?.title).toBe('Karaoke Hit')
    expect(p.currentController?.displayName).toBe('Alex')
  })

  it('GET /api/admin/parties/:id returns one party', async () => {
    partySessionsRepo.findSessionRowForAdminById.mockResolvedValue(sampleListRow())
    const app = makeApp()
    const agent = request.agent(app)
    await loginSuperAdmin(agent)
    const r = await agent.get(`/api/admin/parties/${sid}`)
    expect(r.status).toBe(200)
    expect(r.body.party?.id).toBe(sid)
  })

  it('POST disable logs event and broadcasts', async () => {
    partySessionsRepo.disableSessionById.mockResolvedValue({ id: sid, status: 'disabled' })
    const app = makeApp()
    app.set('io', { to: vi.fn().mockReturnValue({ emit: vi.fn() }) })
    const agent = request.agent(app)
    await loginSuperAdmin(agent)
    const r = await agent.post(`/api/admin/parties/${sid}/disable`).send({})
    expect(r.status).toBe(200)
    expect(r.body.party?.status).toBe('disabled')
    expect(appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: sid,
        eventType: 'admin:party_disabled'
      }),
      expect.anything()
    )
    expect(emitAdminPartyDisabled).toHaveBeenCalled()
  })
})
