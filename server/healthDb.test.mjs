import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './src/app.mjs'

/**
 * Manual: set DATABASE_URL to a real Postgres, run the API, then
 *   curl -s http://localhost:3000/health/db
 * to verify a live database shows database.ok: true in JSON.
 */
describe('GET /health/db', () => {
  it('returns not configured when no pool (no DATABASE_URL in process)', async () => {
    process.env.NODE_ENV = 'test'
    const saved = process.env.DATABASE_URL
    try {
      delete process.env.DATABASE_URL
      const app = createApp({ getPool: () => null })
      const res = await request(app).get('/health/db')
      expect(res.status).toBe(200)
      expect(res.body.database.configured).toBe(false)
      expect(res.body.database.ok).toBe(false)
      expect(res.body.database.message).toBe('DATABASE_URL is not set')
      expect(res.body.database.config).toBeDefined()
      expect(res.body.database.config.hasDatabaseUrl).toBe(false)
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = saved
    }
  })

  it('returns ok when a pool connection succeeds', async () => {
    process.env.NODE_ENV = 'test'
    const app = createApp({
      getPool: () => ({
        query: () => Promise.resolve({ rows: [{ ok: 1 }] })
      })
    })
    const res = await request(app).get('/health/db')
    expect(res.status).toBe(200)
    expect(res.body.database.configured).toBe(true)
    expect(res.body.database.ok).toBe(true)
    expect(res.body.database.config).toBeDefined()
  })

  it('returns ok: false with message when query throws', async () => {
    process.env.NODE_ENV = 'test'
    const app = createApp({
      getPool: () => ({
        query: () => Promise.reject(new Error('connection refused'))
      })
    })
    const res = await request(app).get('/health/db')
    expect(res.status).toBe(200)
    expect(res.body.database.configured).toBe(true)
    expect(res.body.database.ok).toBe(false)
    expect(String(res.body.database.message)).toContain('connection refused')
    expect(res.body.database.config).toBeDefined()
  })
})
