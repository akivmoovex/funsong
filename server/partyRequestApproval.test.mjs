import { beforeEach, describe, expect, it, vi } from 'vitest'
import { approvePartyRequest } from './src/services/partyRequestApproval.mjs'

vi.mock('./src/services/partyCodes.mjs', () => ({
  generateUniquePartyCode: vi.fn().mockResolvedValue('PartyCode01'),
  generateJoinToken: vi.fn().mockReturnValue('jointok-ff')
}))

const reqId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const hostId = '8c4e0d6e-7c5d-4a5a-8c5a-0d6e4c0d6e0d'
const adminId = '1a2b3c4d-1a2b-1a2b-1a2b-123456789abc'

const pr29 = {
  id: reqId,
  host_id: hostId,
  status: 'pending',
  party_name: 'Bash',
  expected_guests: null
}

const pr15 = { ...pr29, expected_guests: 15 }

const oldSessionA = { id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }

/**
 * @param {typeof pr29} prRow
 * @param {{ closeSessionRows?: { id: string }[] }} [opts]
 */
function makePool(prRow, opts) {
  const closeSessionRows = opts?.closeSessionRows ?? []
  const c = { query: vi.fn(), release: vi.fn() }
  c.query.mockImplementation((sql, /** @type {any} */ p) => {
    const s = String(sql)
    if (s === 'BEGIN' || s.startsWith('BEGIN')) {
      return Promise.resolve({ rowCount: 0, rows: [] })
    }
    if (s.includes('SELECT * FROM party_requests') && s.includes('FOR UPDATE')) {
      return Promise.resolve({ rowCount: 1, rows: [prRow] })
    }
    if (s.includes('SELECT 1 FROM party_sessions WHERE party_request_id')) {
      return Promise.resolve({ rowCount: 0, rows: [] })
    }
    if (s.includes('UPDATE party_sessions') && s.includes("status = 'ended'") && s.includes('RETURNING id')) {
      return Promise.resolve({ rowCount: closeSessionRows.length, rows: closeSessionRows })
    }
    if (s.includes('UPDATE control_requests') && s.includes('session_id = $1')) {
      return Promise.resolve({ rowCount: 0, rows: [] })
    }
    if (s.includes('Superseded by a new party for this host')) {
      return Promise.resolve({ rowCount: 0, rows: [] })
    }
    if (s.includes('INSERT INTO party_sessions')) {
      const cap = p[4]
      return Promise.resolve({
        rowCount: 1,
        rows: [
          {
            id: 'ssssssss-ssss-4sss-8sss-ssssssssssss',
            max_guests: cap,
            host_id: prRow.host_id,
            party_code: 'PartyCode01'
          }
        ]
      })
    }
    if (s.includes('UPDATE party_requests') && s.includes("status = 'approved'")) {
      return Promise.resolve({ rowCount: 1, rows: [{ id: prRow.id }] })
    }
    if (s === 'COMMIT' || s.startsWith('COMMIT')) {
      return Promise.resolve({ rowCount: 0, rows: [] })
    }
    if (s === 'ROLLBACK' || s.startsWith('ROLLBACK')) {
      return Promise.resolve({ rowCount: 0, rows: [] })
    }
    return Promise.resolve({ rowCount: 0, rows: [] })
  })
  return { connect: async () => c }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('partyRequestApproval (V1 flow: admin approve → session + max_guests)', () => {
  it('creates session with default max_guests 30 when expected_guests is null (scenario 6)', async () => {
    const pool = makePool(pr29)
    const c = await pool.connect()
    const out = await approvePartyRequest(/** @type {any} */ (pool), reqId, adminId)
    expect(out.ok).toBe(true)
    const ins = c.query.mock.calls.find((a) => String(a[0]).includes('INSERT INTO party_sessions'))
    expect(ins).toBeDefined()
    const params = /** @type {any} */ (ins[1])
    expect(params[4]).toBe(30)
  })

  it('uses expected_guests when in range (e.g. 15)', async () => {
    const pool = makePool(pr15)
    const c = await pool.connect()
    const out = await approvePartyRequest(/** @type {any} */ (pool), reqId, adminId)
    expect(out.ok).toBe(true)
    const ins = c.query.mock.calls.find((a) => String(a[0]).includes('INSERT INTO party_sessions'))
    expect(/** @type {any} */ (ins[1][4])).toBe(15)
  })

  it('ends previous open sessions for the same host and returns their ids (Party B in, Party A out)', async () => {
    const pool = makePool(pr29, { closeSessionRows: [oldSessionA] })
    const c = await pool.connect()
    const out = await approvePartyRequest(/** @type {any} */ (pool), reqId, adminId)
    expect(out.ok).toBe(true)
    if (!out.ok) {
      return
    }
    expect(out.closedSessionIds).toEqual([oldSessionA.id])
    const closeUpd = c.query.mock.calls.find(
      (a) =>
        String(a[0]).includes('UPDATE party_sessions') &&
        String(a[0]).includes("status = 'ended'") &&
        String(a[0]).includes('RETURNING id')
    )
    expect(closeUpd).toBeDefined()
    expect(/** @type {any} */ (closeUpd[1][0])).toBe(hostId)
    const ins = c.query.mock.calls.find((a) => String(a[0]).includes('INSERT INTO party_sessions'))
    expect(ins).toBeDefined()
    const callIdx = (sub) => c.query.mock.calls.findIndex((a) => String(a[0]).includes(sub))
    expect(callIdx("status = 'ended'") < callIdx('INSERT INTO party_sessions')).toBe(true)
  })

  it('does not match ended/disabled in the close-others UPDATE (only approved/active)', async () => {
    const pool = makePool(pr29)
    const c = await pool.connect()
    await approvePartyRequest(/** @type {any} */ (pool), reqId, adminId)
    const closeUpd = c.query.mock.calls.find(
      (a) =>
        String(a[0]).includes('UPDATE party_sessions') &&
        String(a[0]).includes("status = 'ended'") &&
        String(a[0]).includes('RETURNING id')
    )
    expect(String(/** @type {any} */ (closeUpd[0]))).toMatch(
      /status IN \('approved'::party_session_status, 'active'::party_session_status\)/
    )
  })

  it('rejects other pending party_requests for the same host (keeps the one being approved)', async () => {
    const pool = makePool(pr29)
    const c = await pool.connect()
    await approvePartyRequest(/** @type {any} */ (pool), reqId, adminId)
    const rej = c.query.mock.calls.find(
      (a) =>
        String(a[0]).includes('UPDATE party_requests') &&
        String(a[0]).includes("status = 'rejected'") &&
        String(a[0]).includes('id != $4')
    )
    expect(rej).toBeDefined()
    expect(/** @type {any} */ (rej[1][1])).toBe('Superseded by a new party for this host')
    expect(/** @type {any} */ (rej[1][3])).toBe(reqId)
  })
})
