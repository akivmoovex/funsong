import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getJoinPreview } from './src/services/guestJoin.mjs'
import * as partySessionsRepo from './src/db/repos/partySessionsRepo.mjs'
import * as partyGuestsRepo from './src/db/repos/partyGuestsRepo.mjs'

vi.mock('./src/db/repos/partySessionsRepo.mjs', () => ({
  findSessionByPartyCode: vi.fn()
}))

vi.mock('./src/db/repos/partyGuestsRepo.mjs', () => ({
  countConnectedGuestsBySessionId: vi.fn()
}))

const { findSessionByPartyCode } = partySessionsRepo
const { countConnectedGuestsBySessionId } = partyGuestsRepo

beforeEach(() => {
  vi.clearAllMocks()
  countConnectedGuestsBySessionId.mockResolvedValue(0)
})

describe('Prompt 53E: previous parties closed on new create', () => {
  it('join preview blocks the old party code after its session is ended (same as manual end-party)', async () => {
    findSessionByPartyCode.mockResolvedValue({
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'ended',
      title: 'Old bash',
      max_guests: 30
    })
    const p = await getJoinPreview(/** @type {any} */ ({}), 'OLD-CODE')
    expect(p.found).toBe(true)
    expect(/** @type {any} */ (p).canJoin).toBe(false)
  })
})
