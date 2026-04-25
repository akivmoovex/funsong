import { describe, expect, it } from 'vitest'
import request from 'supertest'
import session from 'express-session'
import { createApp } from './src/app.mjs'

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
}

describe('public copyright / routing safeguards', () => {
  it('GET /songs returns 404 (no public song index)', async () => {
    const r = await request(makeApp()).get('/songs')
    expect(r.status).toBe(404)
  })

  it('GET /songs/anything returns 404', async () => {
    const r = await request(makeApp()).get('/songs/foo')
    expect(r.status).toBe(404)
  })

  it('GET /lyrics and /lyrics/x return 404', async () => {
    const a = await request(makeApp()).get('/lyrics')
    const b = await request(makeApp()).get('/lyrics/bar')
    expect(a.status).toBe(404)
    expect(b.status).toBe(404)
  })

  it('does not block /api/songs routes', async () => {
    const r = await request(makeApp()).get('/api/songs/selectable')
    expect(r.status).toBe(401)
  })

  it('GET /api/admin/songs is not a public catalog (auth required)', async () => {
    const r = await request(makeApp()).get('/api/admin/songs')
    expect(r.status).toBe(401)
  })
})
