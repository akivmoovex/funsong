import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as partyGuestsRepo from './src/db/repos/partyGuestsRepo.mjs'
import * as partySessionsRepo from './src/db/repos/partySessionsRepo.mjs'
import { getJoinPreview, performGuestJoin } from './src/services/guestJoin.mjs'

vi.mock('./src/db/repos/partySessionsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, findSessionByPartyCode: vi.fn() }
})
vi.mock('./src/db/repos/partyGuestsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, countConnectedGuestsBySessionId: vi.fn(), createGuest: vi.fn() }
})

const { findSessionByPartyCode } = partySessionsRepo
const { countConnectedGuestsBySessionId, createGuest } = partyGuestsRepo

const sid = 'ssssssss-ssss-4sss-8sss-ssssssssssss'
const code = 'PartyCode01'
const baseSession = {
  id: sid,
  status: 'active',
  max_guests: 30,
  party_code: code,
  title: 'Fun'
}

function makePoolForJoin() {
  const c = { query: vi.fn(), release: vi.fn() }
  c.query.mockImplementation((q) => {
    const s = String(q)
    if (s === 'BEGIN' || s.startsWith('BEGIN')) {
      return Promise.resolve({ rows: [] })
    }
    if (s.includes('SELECT * FROM party_sessions') && s.includes('FOR UPDATE')) {
      return Promise.resolve({ rows: [baseSession] })
    }
    if (s === 'ROLLBACK' || s === 'COMMIT' || s.startsWith('ROLLBACK') || s.startsWith('COMMIT')) {
      return Promise.resolve({ rows: [] })
    }
    return Promise.resolve({ rows: [] })
  })
  return { connect: async () => c }
}

beforeEach(() => {
  vi.clearAllMocks()
  findSessionByPartyCode.mockImplementation(async (pc, p) => {
    void p
    if (pc === code) {
      return { ...baseSession }
    }
    return null
  })
})

describe('getJoinPreview (V1 flow: join link / capacity)', () => {
  it('active session: can join when under capacity (scenario 8 / pre-9)', async () => {
    countConnectedGuestsBySessionId.mockResolvedValue(5)
    const pool = /** @type {any} */ ({})
    const p = await getJoinPreview(/** @type {any} */ (pool), code)
    expect(p.found).toBe(true)
    if (!p.found) {
      return
    }
    expect(p.canJoin).toBe(true)
    expect(p.maxGuests).toBe(30)
  })

  it('ended session: cannot join (host-ended party; scenario 21 at service layer)', async () => {
    findSessionByPartyCode.mockResolvedValueOnce({ ...baseSession, status: 'ended' })
    countConnectedGuestsBySessionId.mockResolvedValue(0)
    const p = await getJoinPreview(/** @type {any} */ ({}), code)
    expect(p.found).toBe(true)
    if (!p.found) {
      return
    }
    expect(p.canJoin).toBe(false)
  })
})

describe('performGuestJoin (V1: guest join + 31st cap)', () => {
  it('joins with display name + language (scenario 8)', async () => {
    countConnectedGuestsBySessionId.mockResolvedValue(0)
    createGuest.mockResolvedValue({ id: 'g1', display_name: 'Pat' })
    const pool = makePoolForJoin()
    const r = await performGuestJoin(/** @type {any} */ (pool), code, {
      displayName: ' Pat ',
      language: 'hindi',
      guestToken: 'tok'
    })
    expect(r.ok).toBe(true)
    if (!r.ok) {
      return
    }
    expect(r.guest?.display_name).toBe('Pat')
    expect(createGuest).toHaveBeenCalled()
  })

  it('31st guest blocked at capacity (scenario 9)', async () => {
    countConnectedGuestsBySessionId.mockResolvedValue(30)
    const pool = makePoolForJoin()
    const r = await performGuestJoin(/** @type {any} */ (pool), code, {
      displayName: 'X',
      language: 'english',
      guestToken: 't2'
    })
    expect(r.ok).toBe(false)
    if (r.ok) {
      return
    }
    expect(r.error).toBe('full')
  })

  it('disabled session: not joinable (scenario 22, service path)', async () => {
    const pool = {
      connect: async () => {
        const c = { query: vi.fn(), release: vi.fn() }
        c.query.mockImplementation((q) => {
          const s = String(q)
          if (s.startsWith('BEGIN')) {
            return Promise.resolve({ rows: [] })
          }
          if (s.includes('SELECT * FROM party_sessions')) {
            return Promise.resolve({ rows: [{ ...baseSession, status: 'disabled' }] })
          }
          if (s.startsWith('ROLLBACK')) {
            return Promise.resolve({ rows: [] })
          }
          return Promise.resolve({ rows: [] })
        })
        return c
      }
    }
    const r = await performGuestJoin(/** @type {any} */ (pool), code, {
      displayName: 'Y',
      language: 'english',
      guestToken: 't3'
    })
    expect(r.ok).toBe(false)
    if (r.ok) {
      return
    }
    expect(r.error).toBe('not_joinable')
  })

  it('two guests with different names can join same party session', async () => {
    countConnectedGuestsBySessionId.mockResolvedValue(0)
    createGuest
      .mockResolvedValueOnce({ id: 'g1', display_name: 'Alice' })
      .mockResolvedValueOnce({ id: 'g2', display_name: 'Bob' })
    const pool = makePoolForJoin()
    const r1 = await performGuestJoin(/** @type {any} */ (pool), code, {
      displayName: 'Alice',
      language: 'english',
      guestToken: 'tok-1'
    })
    const r2 = await performGuestJoin(/** @type {any} */ (pool), code, {
      displayName: 'Bob',
      language: 'english',
      guestToken: 'tok-2'
    })
    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
    expect(createGuest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ displayName: 'Alice' }),
      expect.anything()
    )
    expect(createGuest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ displayName: 'Bob' }),
      expect.anything()
    )
  })
})
