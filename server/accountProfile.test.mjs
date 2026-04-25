import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import * as usersRepo from './src/db/repos/usersRepo.mjs'
import { createApp } from './src/app.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  updateUserProfile: vi.fn(),
  updateUserPassword: vi.fn()
}))

const {
  findUserByEmail,
  findUserById,
  updateUserProfile,
  updateUserPassword
} = usersRepo

const hostId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/** @type {Map<string, any>} */
let byId

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
}

async function loginHost(agent) {
  const r = await agent
    .post('/api/auth/login')
    .send({ email: 'host@example.com', password: 'goodpass123' })
  expect(r.status).toBe(200)
}

beforeEach(() => {
  vi.clearAllMocks()
  byId = new Map()
  byId.set(hostId, {
    id: hostId,
    email: 'host@example.com',
    display_name: 'Host User',
    first_name: 'Host',
    last_name: 'User',
    phone_number: null,
    avatar_key: null,
    role: 'host',
    is_active: true,
    password_hash: bcrypt.hashSync('goodpass123', 4)
  })
  byId.set(otherId, {
    id: otherId,
    email: 'other@example.com',
    display_name: 'Other User',
    first_name: null,
    last_name: null,
    phone_number: null,
    avatar_key: null,
    role: 'host',
    is_active: true,
    password_hash: bcrypt.hashSync('otherpass123', 4)
  })

  findUserById.mockImplementation(async (id) => byId.get(String(id)) || null)
  findUserByEmail.mockImplementation(async (email) => {
    const needle = String(email || '').trim().toLowerCase()
    for (const row of byId.values()) {
      if (String(row.email).toLowerCase() === needle) return row
    }
    return null
  })
  updateUserProfile.mockImplementation(async (id, o) => {
    const row = byId.get(String(id))
    if (!row) return null
    if (Object.prototype.hasOwnProperty.call(o, 'firstName')) row.first_name = o.firstName || null
    if (Object.prototype.hasOwnProperty.call(o, 'lastName')) row.last_name = o.lastName || null
    if (Object.prototype.hasOwnProperty.call(o, 'phoneNumber')) row.phone_number = o.phoneNumber || null
    if (Object.prototype.hasOwnProperty.call(o, 'email')) row.email = String(o.email || '').toLowerCase()
    if (Object.prototype.hasOwnProperty.call(o, 'avatarKey')) row.avatar_key = o.avatarKey || null
    return row
  })
  updateUserPassword.mockImplementation(async (id, passwordHash) => {
    const row = byId.get(String(id))
    if (!row) return null
    row.password_hash = String(passwordHash)
    return row
  })
})

describe('account profile API', () => {
  it('updates profile fields', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post('/api/account/profile').send({
      firstName: 'Akiv',
      lastName: 'Solomon',
      phoneNumber: '+1 555 0101',
      email: 'newhost@example.com',
      avatarKey: 'spark-mic'
    })
    expect(r.status).toBe(200)
    expect(r.body.profile.email).toBe('newhost@example.com')
    expect(r.body.profile.firstName).toBe('Akiv')
    expect(r.body.profile.avatarKey).toBe('spark-mic')
  })

  it('blocks duplicate email', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post('/api/account/profile').send({
      email: 'other@example.com'
    })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('email_taken')
  })

  it('blocks invalid avatar key', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post('/api/account/profile').send({
      email: 'host@example.com',
      avatarKey: 'https://evil.invalid/avatar.png'
    })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('invalid_avatar_key')
  })

  it('blocks password change with wrong current password', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post('/api/account/profile').send({
      email: 'host@example.com',
      currentPassword: 'wrongpass',
      newPassword: 'newsecure123',
      confirmNewPassword: 'newsecure123'
    })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('current_password_invalid')
  })

  it('updates password when current password is correct', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const beforeHash = byId.get(hostId)?.password_hash
    const r = await agent.post('/api/account/profile').send({
      email: 'host@example.com',
      currentPassword: 'goodpass123',
      newPassword: 'newsecure123',
      confirmNewPassword: 'newsecure123'
    })
    expect(r.status).toBe(200)
    const afterHash = byId.get(hostId)?.password_hash
    expect(afterHash).not.toBe(beforeHash)
    const ok = await bcrypt.compare('newsecure123', String(afterHash))
    expect(ok).toBe(true)
  })

  it('cannot change role via profile payload', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginHost(agent)
    const r = await agent.post('/api/account/profile').send({
      email: 'host@example.com',
      role: 'super_admin'
    })
    expect(r.status).toBe(200)
    expect(byId.get(hostId)?.role).toBe('host')
  })
})
