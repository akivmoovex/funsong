import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { createApp } from './src/app.mjs'
import * as usersRepo from './src/db/repos/usersRepo.mjs'
import * as resetRepo from './src/db/repos/passwordResetRequestsRepo.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  updateUserProfile: vi.fn(),
  updateUserPassword: vi.fn()
}))

vi.mock('./src/db/repos/passwordResetRequestsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return {
    ...m,
    createPasswordResetRequest: vi.fn(),
    listPendingPasswordResetRequests: vi.fn()
  }
})

const { findUserByEmail, findUserById } = usersRepo
const { createPasswordResetRequest, listPendingPasswordResetRequests } = resetRepo

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
}

async function loginSuperAdmin(agent) {
  const admin = {
    id: '1a2b3c4d-1a2b-1a2b-1a2b-123456789abc',
    email: 'admin@example.com',
    display_name: 'Admin',
    role: 'super_admin',
    is_active: true,
    password_hash: bcrypt.hashSync('goodpass', 4)
  }
  findUserByEmail.mockResolvedValue(admin)
  findUserById.mockResolvedValue(admin)
  const r = await agent.post('/api/auth/login').send({ email: admin.email, password: 'goodpass' })
  expect(r.status).toBe(200)
}

async function loginHost(agent) {
  const host = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'host@example.com',
    display_name: 'Host',
    role: 'host',
    is_active: true,
    password_hash: bcrypt.hashSync('goodpass', 4)
  }
  findUserByEmail.mockResolvedValue(host)
  findUserById.mockResolvedValue(host)
  const r = await agent.post('/api/auth/login').send({ email: host.email, password: 'goodpass' })
  expect(r.status).toBe(200)
}

describe('forgot password API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createPasswordResetRequest.mockResolvedValue({ id: '1' })
    listPendingPasswordResetRequests.mockResolvedValue([])
  })

  it('returns neutral message for existing account and stores request', async () => {
    findUserByEmail.mockResolvedValueOnce({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'host@example.com'
    })
    const app = makeApp()
    const r = await request(app).post('/api/auth/forgot-password').send({ email: 'host@example.com' })
    expect(r.status).toBe(200)
    expect(r.body.message).toMatch(/If this account exists/i)
    expect(createPasswordResetRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'host@example.com',
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        status: 'pending'
      }),
      expect.anything()
    )
  })

  it('returns same neutral message for unknown account', async () => {
    findUserByEmail.mockResolvedValueOnce(null)
    const app = makeApp()
    const r = await request(app).post('/api/auth/forgot-password').send({ email: 'missing@example.com' })
    expect(r.status).toBe(200)
    expect(r.body.message).toMatch(/If this account exists/i)
    expect(createPasswordResetRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'missing@example.com',
        userId: null,
        status: 'pending'
      }),
      expect.anything()
    )
  })

  it('does not include password or hash fields in response', async () => {
    findUserByEmail.mockResolvedValueOnce(null)
    const app = makeApp()
    const r = await request(app).post('/api/auth/forgot-password').send({
      email: 'missing@example.com',
      password: 'leak-check'
    })
    expect(r.status).toBe(200)
    expect(r.body.password).toBeUndefined()
    expect(r.body.passwordHash).toBeUndefined()
    expect(r.body.hash).toBeUndefined()
  })

  it('super admin can list pending requests', async () => {
    listPendingPasswordResetRequests.mockResolvedValueOnce([
      {
        id: 'r1',
        email: 'host@example.com',
        user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        user_email: 'host@example.com',
        user_display_name: 'Host',
        status: 'pending',
        requested_at: new Date().toISOString()
      }
    ])
    const app = makeApp()
    const agent = request.agent(app)
    await loginSuperAdmin(agent)
    const r = await agent.get('/api/admin/password-reset-requests')
    expect(r.status).toBe(200)
    expect(r.body.requests).toHaveLength(1)
    expect(r.body.requests[0].email).toBe('host@example.com')
  })

  it('host cannot access admin reset request queue', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.get('/api/admin/password-reset-requests')
    expect(r.status).toBe(403)
  })
})
