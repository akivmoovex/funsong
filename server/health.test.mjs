import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './src/app.mjs'

describe('GET /health', () => {
  it('returns JSON status ok', async () => {
    process.env.NODE_ENV = 'test'
    const app = createApp()
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/json/)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
