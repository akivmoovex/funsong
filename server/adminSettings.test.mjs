import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import { createApp } from './src/app.mjs'
import * as settingsSvc from './src/services/appSettingsService.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn()
}))

vi.mock('./src/services/appSettingsService.mjs', () => ({
  getIntSetting: vi.fn(),
  getPartyLimits: vi.fn(),
  updateSetting: vi.fn(),
  getSettingsMap: vi.fn()
}))

const saUid = '1a2b3c4d-1a2b-1a2b-1a2b-123456789abc'
const hostUid = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const emailSa = 's@a.dm'
const emailH = 'h@e.re'

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
  const r = await agent.post('/api/auth/login').send({ email: u.email, password: 'goodpass' })
  expect(r.status).toBe(200)
}

beforeEach(() => {
  vi.clearAllMocks()
  settingsSvc.getPartyLimits.mockResolvedValue({
    maxGuests: 30,
    maxPlaylistSongs: 10,
    autoCloseMinutes: 300
  })
  settingsSvc.getIntSetting
    .mockResolvedValueOnce(30)
    .mockResolvedValueOnce(10)
    .mockResolvedValueOnce(300)
  settingsSvc.updateSetting.mockResolvedValue({})
})

describe('admin settings API', () => {
  it('super admin can view settings', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginAs(agent, 'super_admin')
    const r = await agent.get('/api/admin/settings')
    expect(r.status).toBe(200)
    expect(r.body.settings).toEqual({
      maxPartyGuests: 30,
      maxPlaylistSongs: 10,
      partyAutoCloseMinutes: 300
    })
  })

  it('super admin can update settings', async () => {
    settingsSvc.getIntSetting.mockReset()
    settingsSvc.getIntSetting
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(600)
    const app = makeApp()
    const agent = request.agent(app)
    await loginAs(agent, 'super_admin')
    const r = await agent.post('/api/admin/settings').send({
      maxPartyGuests: 40,
      maxPlaylistSongs: 20,
      partyAutoCloseMinutes: 600
    })
    expect(r.status).toBe(200)
    expect(r.body.settings).toEqual({
      maxPartyGuests: 40,
      maxPlaylistSongs: 20,
      partyAutoCloseMinutes: 600
    })
    expect(settingsSvc.updateSetting).toHaveBeenCalledTimes(3)
  })

  it('invalid values are rejected', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginAs(agent, 'super_admin')
    const r = await agent.post('/api/admin/settings').send({
      maxPartyGuests: 'abc',
      maxPlaylistSongs: 20,
      partyAutoCloseMinutes: 600
    })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('invalid_integer')
  })

  it('out-of-range values are rejected', async () => {
    settingsSvc.updateSetting.mockRejectedValueOnce({ code: 'invalid_integer_setting', message: 'invalid_integer_setting:max_party_guests' })
    const app = makeApp()
    const agent = request.agent(app)
    await loginAs(agent, 'super_admin')
    const r = await agent.post('/api/admin/settings').send({
      maxPartyGuests: 500,
      maxPlaylistSongs: 20,
      partyAutoCloseMinutes: 600
    })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('invalid_range')
  })

  it('host cannot access settings', async () => {
    const app = makeApp()
    const agent = request.agent(app)
    await loginAs(agent, 'host')
    const getResp = await agent.get('/api/admin/settings')
    expect(getResp.status).toBe(403)
    const postResp = await agent.post('/api/admin/settings').send({
      maxPartyGuests: 35,
      maxPlaylistSongs: 12,
      partyAutoCloseMinutes: 300
    })
    expect(postResp.status).toBe(403)
  })
})
