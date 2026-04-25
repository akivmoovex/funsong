import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import { createApp } from './src/app.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn()
}))

const uid = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const email = 'h@e.re'

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
}

function makeUser(role, active) {
  const h = bcrypt.hashSync('goodpass', 4)
  return {
    id: role === 'super_admin' ? '1a2b3c4d-1a2b-1a2b-1a2b-123456789abc' : uid,
    email: role === 'super_admin' ? 's@a.dm' : email,
    display_name: role,
    role,
    password_hash: h,
    is_active: active
  }
}

describe('auth and RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('super admin login reaches super admin route (V1: seeded admin / login)', async () => {
    const us = makeUser('super_admin', true)
    findUserByEmail.mockResolvedValue(us)
    findUserById.mockImplementation((id) =>
      id === '1a2b3c4d-1a2b-1a2b-1a2b-123456789abc' ? Promise.resolve(us) : Promise.resolve(null)
    )
    const app = makeApp()
    const agent = request.agent(app)
    const r = await agent.post('/api/auth/login').send({ email: 's@a.dm', password: 'goodpass' })
    expect(r.status).toBe(200)
    expect(r.body.user?.role).toBe('super_admin')
    const p = await agent.get('/api/protected/health-super')
    expect(p.status).toBe(200)
    expect(p.body.role).toBe('super_admin')
  })

  it('logs in successfully and can reach host route', async () => {
    const us = makeUser('host', true)
    findUserByEmail.mockResolvedValue(us)
    findUserById.mockImplementation((id) => (id === uid ? Promise.resolve(us) : Promise.resolve(null)))
    const app = makeApp()
    const agent = request.agent(app)
    const r = await agent.post('/api/auth/login').send({ email, password: 'goodpass' })
    expect(r.status).toBe(200)
    expect(r.body.user?.email).toBe(email)
    const cookie = r.headers['set-cookie']
    const hasCookie = Array.isArray(cookie) ? cookie.length > 0 : Boolean(cookie)
    expect(hasCookie).toBe(true)
    const p = await agent.get('/api/protected/health-host')
    expect(p.status).toBe(200)
    expect(p.body.role).toBe('host')
  })

  it('rejects wrong password', async () => {
    const us = makeUser('host', true)
    findUserByEmail.mockResolvedValue(us)
    const r = await request(makeApp())
      .post('/api/auth/login')
      .send({ email, password: 'nope' })
    expect(r.status).toBe(401)
  })

  it('blocks inactive user from login', async () => {
    const us = makeUser('host', false)
    findUserByEmail.mockResolvedValue(us)
    const r = await request(makeApp())
      .post('/api/auth/login')
      .send({ email, password: 'goodpass' })
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('inactive')
  })

  it('host cannot access super admin API', async () => {
    const h = makeUser('host', true)
    findUserByEmail.mockResolvedValue(h)
    findUserById.mockImplementation((id) => (id === uid ? Promise.resolve(h) : Promise.resolve(null)))
    const agent = request.agent(makeApp())
    await agent.post('/api/auth/login').send({ email, password: 'goodpass' })
    const p = await agent.get('/api/protected/health-super')
    expect(p.status).toBe(403)
  })

  it('blocks unauthenticated API', async () => {
    const p = await request(makeApp()).get('/api/protected/health-host')
    expect(p.status).toBe(401)
  })
})
