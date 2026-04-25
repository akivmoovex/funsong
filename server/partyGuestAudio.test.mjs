import { describe, expect, it } from 'vitest'
import request from 'supertest'
import session from 'express-session'
import { createApp } from './src/app.mjs'

describe('GET /api/party/:partyCode/active-song-audio', () => {
  it('returns 401 without guest cookie', async () => {
    const app = createApp({
      sessionStore: new session.MemoryStore(),
      getPool: () =>
        /** @type {import('pg').Pool} */ (
          /** @type {unknown} */ ({
            query: async () => ({ rows: [] })
          })
        )
    })
    const r = await request(app).get('/api/party/MyCode9/active-song-audio')
    expect(r.status).toBe(401)
  })
})
