import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import session from 'express-session'
import { createApp } from './src/app.mjs'
import * as crRepo from './src/db/repos/controlRequestsRepo.mjs'

const { hasPendingControlForGuest } = crRepo

const CODE = 'JoinCode01'
const SESSION_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const GUEST_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'
const SONG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const GUEST_TOK = 'aabbccdd001122'

function makeControlRequestPool(opts = {}) {
  const hasActiveSong = opts.hasActiveSong !== false
  return {
    query: async (/** @type {string} */ sql, /** @type {unknown[]} */ params) => {
      const s = String(sql)
      if (s.includes('FROM party_guests g') && s.includes('INNER JOIN party_sessions') && s.includes('guest_token')) {
        if (params[0] === GUEST_TOK && params[1] === CODE) {
          return {
            rows: [
              {
                id: GUEST_ID,
                display_name: 'G',
                session_pk: SESSION_ID,
                session_status: 'active',
                language_preference: 'english',
                max_guests: 30
              }
            ]
          }
        }
        return { rows: [] }
      }
      if (s.includes('SELECT * FROM party_sessions') && s.includes('party_code = $1::text')) {
        if (params[0] === CODE) {
          return {
            rows: [
              {
                id: SESSION_ID,
                status: 'active',
                party_code: CODE,
                active_song_id: hasActiveSong ? SONG_ID : null,
                playback_status: hasActiveSong ? 'playing' : 'idle'
              }
            ]
          }
        }
        return { rows: [] }
      }
      if (s.includes('FROM party_playlist_items ppi') && s.includes('INNER JOIN songs s')) {
        return {
          rows: [
            {
              playlist_item_id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20',
              position: 0,
              item_status: 'pending',
              id: SONG_ID,
              title: 'Demo song',
              difficulty: null,
              is_public: true,
              status: 'published',
              rights_status: 'clear',
              tags: [],
              audio_file_url: null,
              instrumental_audio_path: null,
              tag_list: [],
              audio_ok: true,
              lyrics_ok: true
            }
          ]
        }
      }
      if (s.includes('FROM control_requests') && s.includes('party_guest_id = $2::uuid') && s.includes('pending')) {
        return { rowCount: 0 }
      }
      if (s.includes('SELECT 1 FROM party_playlist_items WHERE session_id = $1::uuid AND song_id = $2::uuid')) {
        return { rowCount: 1, rows: [{ '?column?': 1 }] }
      }
      if (s.includes('INSERT INTO control_requests')) {
        return {
          rows: [
            {
              id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10',
              session_id: SESSION_ID,
              party_guest_id: GUEST_ID,
              song_id: SONG_ID,
              status: 'pending'
            }
          ]
        }
      }
      return { rows: [] }
    }
  }
}

describe('hasPendingControlForGuest', () => {
  it('returns true when a row exists', async () => {
    const pool = {
      query: async () => ({ rowCount: 1 })
    }
    const h = await hasPendingControlForGuest(
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10',
      /** @type {any} */ (pool)
    )
    expect(h).toBe(true)
  })

  it('scopes pending check to control request kind', async () => {
    const pool = {
      query: async (sql) => {
        expect(String(sql)).toContain("request_kind = 'control'")
        return { rowCount: 0 }
      }
    }
    const h = await hasPendingControlForGuest(
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10',
      /** @type {any} */ (pool)
    )
    expect(h).toBe(false)
  })
})

describe('POST /api/party/:code/request-control', () => {
  it('creates a pending request when session has active song (201)', async () => {
    const app = createApp({
      sessionStore: new session.MemoryStore(),
      getPool: () => makeControlRequestPool()
    })
    app.set('io', { to: () => ({ emit: vi.fn() }) })
    const r = await request(app)
      .post(`/api/party/${encodeURIComponent(CODE)}/request-control`)
      .set('Cookie', [`fs_guest=${GUEST_TOK}`])
      .send({})
    expect(r.status).toBe(201)
    expect(r.body.ok).toBe(true)
    expect(r.body.request?.id).toBeDefined()
  })

  it('returns 401 when guest cookie does not match this party (another party / invalid)', async () => {
    const app = createApp({
      sessionStore: new session.MemoryStore(),
      getPool: () => makeControlRequestPool()
    })
    const r = await request(app)
      .post(`/api/party/wrongcode99/request-control`)
      .set('Cookie', [`fs_guest=${GUEST_TOK}`])
      .send({})
    expect(r.status).toBe(401)
  })

  it('creates a pending request for selected playlist song', async () => {
    const app = createApp({
      sessionStore: new session.MemoryStore(),
      getPool: () => makeControlRequestPool()
    })
    app.set('io', { to: () => ({ emit: vi.fn() }) })
    const r = await request(app)
      .post(`/api/party/${encodeURIComponent(CODE)}/request-control`)
      .set('Cookie', [`fs_guest=${GUEST_TOK}`])
      .send({ songId: SONG_ID })
    expect(r.status).toBe(201)
    expect(r.body.ok).toBe(true)
    expect(r.body.request?.songId).toBe(SONG_ID)
  })

  it('creates a pending request from queued song when no active song', async () => {
    const app = createApp({
      sessionStore: new session.MemoryStore(),
      getPool: () => makeControlRequestPool({ hasActiveSong: false })
    })
    app.set('io', { to: () => ({ emit: vi.fn() }) })
    const r = await request(app)
      .post(`/api/party/${encodeURIComponent(CODE)}/request-control`)
      .set('Cookie', [`fs_guest=${GUEST_TOK}`])
      .send({})
    expect(r.status).toBe(201)
    expect(r.body.ok).toBe(true)
    expect(r.body.request?.songId).toBe(SONG_ID)
  })
})

