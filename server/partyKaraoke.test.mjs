import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import { findUserByEmail, findUserById } from './src/db/repos/usersRepo.mjs'
import * as partySongControl from './src/services/partySongControl.mjs'
import { createApp } from './src/app.mjs'
import { pickLineTextForLanguage, buildPartyKaraokeState } from './src/services/partyKaraokeState.mjs'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn()
}))

vi.mock('./src/db/repos/partyRequestsRepo.mjs', () => ({
  findRequestByIdForHost: vi.fn()
}))

vi.mock('./src/db/repos/partySessionsRepo.mjs', async (importOriginal) => {
  const a = await importOriginal()
  return { ...a, findSessionByPartyRequestId: vi.fn() }
})

vi.mock('./src/services/partySongControl.mjs', () => ({
  startPartySong: vi.fn(),
  setPartySongPlaybackOp: vi.fn()
}))

import * as partyRequestsRepo from './src/db/repos/partyRequestsRepo.mjs'
import * as partySessionsRepo from './src/db/repos/partySessionsRepo.mjs'

const { findRequestByIdForHost } = partyRequestsRepo
const { findSessionByPartyRequestId } = partySessionsRepo
const { startPartySong, setPartySongPlaybackOp } = partySongControl

const hostUid = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const prId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sessionId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const emailH = 'hostK@e.re'

function makeUser() {
  return {
    id: hostUid,
    email: emailH,
    display_name: 'host',
    role: 'host',
    is_active: true,
    password_hash: bcrypt.hashSync('goodpass', 4)
  }
}

function makeApp() {
  return createApp({
    sessionStore: new session.MemoryStore(),
    getPool: () => ({ query: async () => ({ rows: [] }) })
  })
}

function sampleState() {
  return {
    sessionId,
    sessionStatus: 'active',
    playbackStatus: 'playing',
    currentLineNumber: 1,
    activeSong: { id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', title: 'Song A' },
    activePlaylistItemId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10',
    controller: null,
    lyricLines: [],
    currentLine: null,
    currentLineText: null,
    languagePreference: 'english',
    connectedGuestCount: 0
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('pickLineTextForLanguage', () => {
  it('picks Hindi with English fallback', () => {
    const t = pickLineTextForLanguage(
      { textEnglish: 'a', textHindi: '', textHebrew: '' },
      'hindi'
    )
    expect(t).toBe('a')
  })
})

describe('host karaoke control API (mocked service)', () => {
  it('host can start a song (200)', async () => {
    const pr = {
      id: prId,
      host_id: hostUid,
      status: 'approved',
      party_name: 'K',
      event_datetime: new Date('2030-01-01'),
      expected_guests: 10
    }
    const srow = { id: sessionId, party_request_id: prId, host_id: hostUid, status: 'approved' }
    findRequestByIdForHost.mockResolvedValue(pr)
    findSessionByPartyRequestId.mockResolvedValue(srow)
    startPartySong.mockResolvedValue({ ok: true, state: sampleState() })
    const app = makeApp()
    app.set('io', { to: () => ({ emit: vi.fn() }) })
    const agent = request.agent(app)
    const u = makeUser()
    findUserByEmail.mockResolvedValue(u)
    findUserById.mockImplementation((id) => (id === hostUid ? Promise.resolve(u) : Promise.resolve(null)))
    await agent.post('/api/auth/login').send({ email: emailH, password: 'goodpass' })
    const r = await agent
      .post(`/api/host/parties/${prId}/start-song`)
      .send({ playlistItemId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10' })
    expect(r.status).toBe(200)
    expect(r.body.ok).toBe(true)
    expect(r.body.state?.playbackStatus).toBe('playing')
    expect(startPartySong).toHaveBeenCalled()
  })

  it('pause and resume return state', async () => {
    const pr = {
      id: prId,
      host_id: hostUid,
      status: 'approved',
      party_name: 'K',
      event_datetime: new Date('2030-01-01'),
      expected_guests: 10
    }
    const srow = {
      id: sessionId,
      party_request_id: prId,
      host_id: hostUid,
      status: 'active',
      playback_status: 'playing',
      active_playlist_item_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10'
    }
    findRequestByIdForHost.mockResolvedValue(pr)
    findSessionByPartyRequestId.mockResolvedValue(srow)
    setPartySongPlaybackOp
      .mockResolvedValueOnce({ ok: true, state: { ...sampleState(), playbackStatus: 'paused' } })
      .mockResolvedValueOnce({ ok: true, state: sampleState() })
    const app = makeApp()
    app.set('io', { to: () => ({ emit: vi.fn() }) })
    const agent = request.agent(app)
    const u = makeUser()
    findUserByEmail.mockResolvedValue(u)
    findUserById.mockImplementation((id) => (id === hostUid ? Promise.resolve(u) : Promise.resolve(null)))
    await agent.post('/api/auth/login').send({ email: emailH, password: 'goodpass' })
    const p = await agent.post(`/api/host/parties/${prId}/pause-song`)
    expect(p.status).toBe(200)
    expect(p.body.state?.playbackStatus).toBe('paused')
    const res = await agent.post(`/api/host/parties/${prId}/resume-song`)
    expect(res.status).toBe(200)
    expect(res.body.state?.playbackStatus).toBe('playing')
  })

  it('end-song clears active song in state', async () => {
    const pr = {
      id: prId,
      host_id: hostUid,
      status: 'approved',
      party_name: 'K',
      event_datetime: new Date('2030-01-01'),
      expected_guests: 10
    }
    const srow = {
      id: sessionId,
      party_request_id: prId,
      host_id: hostUid,
      status: 'active',
      active_playlist_item_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10'
    }
    findRequestByIdForHost.mockResolvedValue(pr)
    findSessionByPartyRequestId.mockResolvedValue(srow)
    setPartySongPlaybackOp.mockResolvedValue({
      ok: true,
      state: { ...sampleState(), activeSong: null, activePlaylistItemId: null, playbackStatus: 'idle' }
    })
    const app = makeApp()
    app.set('io', { to: () => ({ emit: vi.fn() }) })
    const agent = request.agent(app)
    const u = makeUser()
    findUserByEmail.mockResolvedValue(u)
    findUserById.mockImplementation((id) => (id === hostUid ? Promise.resolve(u) : Promise.resolve(null)))
    await agent.post('/api/auth/login').send({ email: emailH, password: 'goodpass' })
    const r = await agent.post(`/api/host/parties/${prId}/end-song`)
    expect(r.status).toBe(200)
    expect(r.body.state?.activeSong).toBeNull()
    expect(r.body.state?.playbackStatus).toBe('idle')
  })
})

describe('buildPartyKaraokeState (mock pool)', () => {
  it('builds state with active song and line text', async () => {
    const songId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10'
    const pool = {
      query: vi.fn(async (/** @type {string} */ sql) => {
        const s = String(sql)
        if (s.includes('party_sessions') && s.includes('WHERE id = $1::uuid') && s.includes('SELECT *')) {
          return {
            rows: [
              {
                id: sessionId,
                status: 'active',
                party_code: 'XCODE1',
                playback_status: 'playing',
                current_line_number: 0,
                active_song_id: songId,
                active_playlist_item_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10',
                current_controller_party_guest_id: null
              }
            ]
          }
        }
        if (s.includes('party_guests') && s.includes('count(*)') && s.includes('is_connected = true')) {
          return { rows: [{ c: 0 }] }
        }
        if (s.includes('FROM songs s') && s.includes('WHERE s.id = $1::uuid')) {
          return {
            rows: [
              {
                id: songId,
                title: 'T',
                movie_name: null,
                original_artist: null,
                composer: null,
                lyricist: null,
                year: null,
                duration_ms: null,
                difficulty: null,
                status: 'published',
                rights_status: 'licensed',
                is_default_suggestion: false,
                instrumental_audio_path: null,
                audio_file_url: null,
                audio_mime_type: null,
                created_by: null,
                created_at: new Date(),
                updated_at: new Date(),
                tag_list: []
              }
            ]
          }
        }
        if (s.includes('FROM lyric_lines') && s.includes('WHERE song_id = $1::uuid')) {
          return {
            rows: [
              {
                id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10',
                line_number: 0,
                start_time_seconds: null,
                end_time_seconds: null,
                text_english: 'Line zero',
                text_hindi: '',
                text_hebrew: ''
              }
            ]
          }
        }
        return { rows: [] }
      })
    }
    const st = await buildPartyKaraokeState(sessionId, /** @type {any} */ (pool), {
      languagePreference: 'english'
    })
    expect(st).not.toBeNull()
    expect(/** @type {any} */ (st).playbackStatus).toBe('playing')
    expect(/** @type {any} */ (st).currentLineText).toBe('Line zero')
    expect(/** @type {any} */ (st).lyricLines?.length).toBe(1)
  })

  it('returns connected guests scoped to the party session', async () => {
    const pool = {
      query: vi.fn(async (/** @type {string} */ sql, /** @type {unknown[]} */ params) => {
        const s = String(sql)
        if (s.includes('party_sessions') && s.includes('WHERE id = $1::uuid') && s.includes('SELECT *')) {
          return {
            rows: [
              {
                id: sessionId,
                status: 'active',
                party_code: 'XCODE1',
                playback_status: 'idle',
                current_line_number: 1,
                active_song_id: null,
                active_playlist_item_id: null,
                current_controller_party_guest_id: null
              }
            ]
          }
        }
        if (s.includes('party_guests') && s.includes('count(*)') && s.includes('is_connected = true')) {
          return { rows: [{ c: 2 }] }
        }
        if (
          s.includes('FROM party_guests') &&
          s.includes('display_name') &&
          s.includes('is_connected = true')
        ) {
          const sidParam = String(params?.[0] || '')
          if (sidParam === sessionId) {
            return {
              rows: [
                { id: 'g1', display_name: 'Guest One' },
                { id: 'g2', display_name: 'Guest Two' }
              ]
            }
          }
          return { rows: [{ id: 'g999', display_name: 'Other Party Guest' }] }
        }
        return { rows: [] }
      })
    }
    const st = await buildPartyKaraokeState(sessionId, /** @type {any} */ (pool), {})
    expect(st).not.toBeNull()
    expect(/** @type {any} */ (st).connectedGuestCount).toBe(2)
    expect(/** @type {any} */ (st).connectedGuests).toEqual([
      { id: 'g1', displayName: 'Guest One' },
      { id: 'g2', displayName: 'Guest Two' }
    ])
  })
})
