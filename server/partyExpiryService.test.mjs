import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as partyEventsRepo from './src/db/repos/partyEventsRepo.mjs'
import * as controlRequestsRepo from './src/db/repos/controlRequestsRepo.mjs'
import * as appSettingsService from './src/services/appSettingsService.mjs'
import {
  closeExpiredParties,
  ensurePartyNotExpired,
  isSessionExpiredByTime
} from './src/services/partyExpiryService.mjs'

vi.mock('./src/db/repos/partyEventsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, appendEvent: vi.fn() }
})

vi.mock('./src/db/repos/controlRequestsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, rejectAllPendingForSession: vi.fn() }
})
vi.mock('./src/services/appSettingsService.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, getIntSetting: vi.fn() }
})

const { appendEvent } = partyEventsRepo
const { rejectAllPendingForSession } = controlRequestsRepo
const { getIntSetting } = appSettingsService

function makeSession({
  id,
  status = 'approved',
  createdAt,
  startedAt = null,
  partyCode = null,
  partyRequestId = null
}) {
  return {
    id,
    status,
    created_at: createdAt.toISOString(),
    started_at: startedAt ? startedAt.toISOString() : null,
    party_code: partyCode,
    party_request_id: partyRequestId,
    playback_status: 'idle',
    active_song_id: null,
    active_playlist_item_id: null,
    current_line_number: null,
    current_controller_party_guest_id: null,
    controller_audio_enabled: false
  }
}

function makePool({ sessions, autoCloseMinutes = 300, hasStartedAt = true, hasEndedAt = true }) {
  const byId = new Map(sessions.map((s) => [String(s.id), { ...s }]))
  const queryCore = async (sql, params = []) => {
    const text = String(sql)
    if (text.includes('information_schema.columns')) {
      const col = String(params[0] || '')
      if (col === 'started_at') {
        return { rows: hasStartedAt ? [{ exists: 1 }] : [] }
      }
      if (col === 'ended_at') {
        return { rows: hasEndedAt ? [{ exists: 1 }] : [] }
      }
      return { rows: [] }
    }
    if (text.includes('FROM party_sessions') && text.includes('WHERE status IN')) {
      return {
        rows: [...byId.values()].filter((s) => s.status === 'approved' || s.status === 'active')
      }
    }
    if (text.includes('WHERE party_code = $1::text')) {
      const code = String(params[0] || '')
      const row = [...byId.values()].find(
        (s) => String(s.party_code || '') === code && (s.status === 'approved' || s.status === 'active')
      )
      return { rows: row ? [row] : [] }
    }
    if (text.includes('WHERE party_request_id = $1::uuid')) {
      const requestId = String(params[0] || '')
      const row = [...byId.values()].find(
        (s) =>
          String(s.party_request_id || '') === requestId &&
          (s.status === 'approved' || s.status === 'active')
      )
      return { rows: row ? [row] : [] }
    }
    if (text.includes('WHERE id = $1::uuid') && text.includes('FOR UPDATE')) {
      const id = String(params[0] || '')
      const row = byId.get(id)
      return { rows: row ? [row] : [] }
    }
    if (text.includes('WHERE id = $1::uuid') && text.includes('status IN')) {
      const id = String(params[0] || '')
      const row = byId.get(id)
      if (!row) return { rows: [] }
      return { rows: row.status === 'approved' || row.status === 'active' ? [row] : [] }
    }
    if (text.includes('UPDATE party_sessions') && text.includes("SET status = 'ended'")) {
      const id = String(params[0] || '')
      const row = byId.get(id)
      if (!row) return { rows: [] }
      row.status = 'ended'
      row.ended_at = new Date().toISOString()
      return { rows: [row] }
    }
    return { rows: [] }
  }
  return {
    query: queryCore,
    connect: async () => ({
      query: async (sql, params = []) => {
        const text = String(sql)
        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
          return { rows: [] }
        }
        return queryCore(sql, params)
      },
      release: () => {}
    }),
    _sessions: byId
  }
}

describe('partyExpiryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getIntSetting.mockImplementation(async (key, defaultValue) => {
      if (key === 'party_auto_close_minutes') return 300
      return defaultValue
    })
  })

  it('helper marks session expired using started_at first', () => {
    const now = new Date('2031-01-01T12:00:00.000Z')
    const oldStarted = new Date('2031-01-01T06:00:00.000Z')
    const freshCreated = new Date('2031-01-01T11:30:00.000Z')
    expect(
      isSessionExpiredByTime(
        { started_at: oldStarted.toISOString(), created_at: freshCreated.toISOString() },
        300,
        now
      )
    ).toBe(true)
  })

  it('closes approved party older than configured setting', async () => {
    const old = makeSession({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'approved',
      createdAt: new Date('2031-01-01T00:00:00.000Z'),
      partyCode: 'OLDAPPROVED'
    })
    const pool = makePool({ sessions: [old], autoCloseMinutes: 300 })
    getIntSetting.mockResolvedValueOnce(300)
    const out = await closeExpiredParties({
      getPool: () => /** @type {any} */ (pool),
      now: new Date('2031-01-01T06:00:00.000Z')
    })
    expect(out.closed).toBe(1)
    expect(pool._sessions.get(old.id)?.status).toBe('ended')
  })

  it('closes active party older than configured setting', async () => {
    const old = makeSession({
      id: '22222222-2222-4222-8222-222222222222',
      status: 'active',
      createdAt: new Date('2031-01-01T00:00:00.000Z'),
      partyCode: 'OLDACTIVE'
    })
    const pool = makePool({ sessions: [old], autoCloseMinutes: 300 })
    getIntSetting.mockResolvedValueOnce(300)
    const out = await closeExpiredParties({
      getPool: () => /** @type {any} */ (pool),
      now: new Date('2031-01-01T06:01:00.000Z')
    })
    expect(out.closed).toBe(1)
    expect(pool._sessions.get(old.id)?.status).toBe('ended')
  })

  it('keeps newer party open', async () => {
    const fresh = makeSession({
      id: '33333333-3333-4333-8333-333333333333',
      status: 'active',
      createdAt: new Date('2031-01-01T05:30:00.000Z'),
      partyCode: 'FRESH'
    })
    const pool = makePool({ sessions: [fresh], autoCloseMinutes: 300 })
    getIntSetting.mockResolvedValueOnce(300)
    const out = await closeExpiredParties({
      getPool: () => /** @type {any} */ (pool),
      now: new Date('2031-01-01T06:00:00.000Z')
    })
    expect(out.closed).toBe(0)
    expect(pool._sessions.get(fresh.id)?.status).toBe('active')
  })

  it('lazy ensure closes by partyCode and leaves ended status for follow-up checks', async () => {
    const old = makeSession({
      id: '44444444-4444-4444-8444-444444444444',
      status: 'approved',
      createdAt: new Date('2031-01-01T00:00:00.000Z'),
      partyCode: 'LAZYCODE'
    })
    const pool = makePool({ sessions: [old], autoCloseMinutes: 300 })
    getIntSetting.mockResolvedValueOnce(300)
    const out = await ensurePartyNotExpired({
      getPool: () => /** @type {any} */ (pool),
      partyCode: 'LAZYCODE',
      now: new Date('2031-01-01T08:00:00.000Z')
    })
    expect(out.expired).toBe(true)
    expect(pool._sessions.get(old.id)?.status).toBe('ended')
  })

  it('logs event when a party is auto-closed', async () => {
    const old = makeSession({
      id: '55555555-5555-4555-8555-555555555555',
      status: 'approved',
      createdAt: new Date('2031-01-01T00:00:00.000Z'),
      partyCode: 'LOGME'
    })
    const pool = makePool({ sessions: [old], autoCloseMinutes: 300 })
    getIntSetting.mockResolvedValueOnce(300)
    await closeExpiredParties({
      getPool: () => /** @type {any} */ (pool),
      now: new Date('2031-01-01T06:00:00.000Z')
    })
    expect(rejectAllPendingForSession).toHaveBeenCalled()
    expect(appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: old.id,
        eventType: 'party_expired',
        payload: expect.objectContaining({ source: 'auto_close' })
      }),
      expect.anything()
    )
  })
})
