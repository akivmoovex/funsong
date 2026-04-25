import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import session from 'express-session'
import { createApp } from './src/app.mjs'
import { maxFromEnv, windowMsFromEnv } from './src/middleware/rateLimit.mjs'

describe('rateLimit config helpers', () => {
  const save = { ...process.env }
  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in save)) {
        delete process.env[k]
      }
    }
    Object.assign(process.env, save)
  })

  it('uses defaults when env missing', () => {
    delete process.env.RATE_LIMIT_LOGIN_WINDOW_MINUTES
    delete process.env.RATE_LIMIT_LOGIN_WINDOW_MS
    expect(windowMsFromEnv('RATE_LIMIT_LOGIN_WINDOW_MINUTES', 15, 'RATE_LIMIT_LOGIN_WINDOW_MS')).toBe(
      15 * 60 * 1000
    )
    delete process.env.RATE_LIMIT_LOGIN_MAX
    expect(maxFromEnv('RATE_LIMIT_LOGIN_MAX', 20)).toBe(20)
  })

  it('respects *_MS when set', () => {
    process.env.RATE_LIMIT_LOGIN_WINDOW_MS = '5000'
    expect(
      windowMsFromEnv('RATE_LIMIT_LOGIN_WINDOW_MINUTES', 15, 'RATE_LIMIT_LOGIN_WINDOW_MS')
    ).toBe(5000)
  })
})

describe('rate limit enforcement (RATE_LIMIT_BYPASS=0, VITEST cleared)', () => {
  const save = { ...process.env }

  function makeApp() {
    return createApp({
      sessionStore: new session.MemoryStore(),
      getPool: () => null
    })
  }

  beforeEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in save)) {
        delete process.env[k]
      }
    }
    Object.assign(process.env, save)
    process.env.RATE_LIMIT_BYPASS = '0'
    delete process.env.VITEST
    process.env.RATE_LIMIT_LOGIN_MAX = '2'
    process.env.RATE_LIMIT_LOGIN_WINDOW_MS = '120000'
    process.env.RATE_LIMIT_JOIN_MAX = '2'
    process.env.RATE_LIMIT_JOIN_WINDOW_MS = '120000'
  })

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in save)) {
        delete process.env[k]
      }
    }
    Object.assign(process.env, save)
  })

  it('returns 429 on login after RATE_LIMIT_LOGIN_MAX attempts', async () => {
    const app = makeApp()
    const a = request(app)
    const r1 = await a.post('/api/auth/login').send({ email: 'a@a.com', password: 'x' })
    const r2 = await a.post('/api/auth/login').send({ email: 'a@a.com', password: 'x' })
    const r3 = await a.post('/api/auth/login').send({ email: 'a@a.com', password: 'x' })
    expect(r1.status).not.toBe(429)
    expect(r2.status).not.toBe(429)
    expect(r3.status).toBe(429)
    expect(r3.body.error).toBe('rate_limited')
    expect(r3.body.message).toMatch(/Too many attempts/i)
  })

  it('returns 429 on guest join POST after RATE_LIMIT_JOIN_MAX', async () => {
    const app = makeApp()
    const a = request(app)
    const body = { displayName: 'A', language: 'english' }
    const r1 = await a.post('/api/join/Party01').send(body)
    const r2 = await a.post('/api/join/Party01').send(body)
    const r3 = await a.post('/api/join/Party01').send(body)
    expect(r1.status).not.toBe(429)
    expect(r2.status).not.toBe(429)
    expect(r3.status).toBe(429)
    expect(r3.body.message).toMatch(/Too many attempts/i)
  })
})

describe('rate limit: normal path under test env (VITEST bypass)', () => {
  it('first login is not 429 in default vitest environment', async () => {
    const app = createApp({
      sessionStore: new session.MemoryStore(),
      getPool: () => null
    })
    const r = await request(app).post('/api/auth/login').send({ email: 'x@y.z', password: 'p' })
    expect(r.status).not.toBe(429)
  })
})
