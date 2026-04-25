import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { createUser, findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import { createApp } from './src/app.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn()
}))

const uid = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const email = 'host@example.com'

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
}

function makeCreatedHost(password = 'goodpass123') {
  return {
    id: uid,
    email,
    display_name: 'Host Name',
    role: 'host',
    is_active: true,
    password_hash: bcrypt.hashSync(password, 4)
  }
}

describe('host signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findUserByEmail.mockResolvedValue(null)
    createUser.mockResolvedValue(makeCreatedHost())
    findUserById.mockImplementation((id) =>
      id === uid ? Promise.resolve(makeCreatedHost()) : Promise.resolve(null)
    )
  })

  it('signup creates an active host user and starts session', async () => {
    const agent = request.agent(makeApp())
    const r = await agent.post('/signup').send({
      displayName: 'Host Name',
      email,
      password: 'goodpass123',
      confirmPassword: 'goodpass123'
    })
    expect(r.status).toBe(201)
    expect(r.body.user?.role).toBe('host')
    expect(r.body.user?.isActive).toBe(true)
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'host',
        displayName: 'Host Name'
      }),
      expect.anything()
    )
    const hostHealth = await agent.get('/api/protected/health-host')
    expect(hostHealth.status).toBe(200)
  })

  it('duplicate email is blocked', async () => {
    findUserByEmail.mockResolvedValue(makeCreatedHost())
    const r = await request(makeApp()).post('/signup').send({
      displayName: 'Host Name',
      email,
      password: 'goodpass123',
      confirmPassword: 'goodpass123'
    })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('email_taken')
    expect(createUser).not.toHaveBeenCalled()
  })

  it('password mismatch is blocked', async () => {
    const r = await request(makeApp()).post('/signup').send({
      displayName: 'Host Name',
      email,
      password: 'goodpass123',
      confirmPassword: 'goodpass999'
    })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('password_mismatch')
    expect(createUser).not.toHaveBeenCalled()
  })

  it('short password is blocked', async () => {
    const r = await request(makeApp()).post('/signup').send({
      displayName: 'Host Name',
      email,
      password: 'short',
      confirmPassword: 'short'
    })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('password_too_short')
    expect(createUser).not.toHaveBeenCalled()
  })

  it('created user role is always host', async () => {
    const r = await request(makeApp()).post('/signup').send({
      displayName: 'Host Name',
      email,
      password: 'goodpass123',
      confirmPassword: 'goodpass123',
      role: 'super_admin'
    })
    expect(r.status).toBe(201)
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'host'
      }),
      expect.anything()
    )
  })

  it('signed-up host cannot access /admin protected API', async () => {
    const agent = request.agent(makeApp())
    const r = await agent.post('/signup').send({
      displayName: 'Host Name',
      email,
      password: 'goodpass123',
      confirmPassword: 'goodpass123'
    })
    expect(r.status).toBe(201)
    const adminCheck = await agent.get('/api/protected/health-super')
    expect(adminCheck.status).toBe(403)
  })

  it('host can log in after signup', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    const created = makeCreatedHost('goodpass123')
    createUser.mockResolvedValue(created)
    findUserById.mockImplementation((id) => (id === uid ? Promise.resolve(created) : Promise.resolve(null)))
    findUserByEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValue(created)
    const signup = await agent.post('/signup').send({
      displayName: 'Host Name',
      email,
      password: 'goodpass123',
      confirmPassword: 'goodpass123'
    })
    expect(signup.status).toBe(201)
    await agent.post('/logout').send({})
    const login = await agent.post('/api/auth/login').send({
      email,
      password: 'goodpass123'
    })
    expect(login.status).toBe(200)
    expect(login.body.user?.role).toBe('host')
  })
})
