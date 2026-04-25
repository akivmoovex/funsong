import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as partyGuests from './src/db/repos/partyGuestsRepo.mjs'

vi.mock('./src/db/repos/partyGuestsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return { ...m, countConnectedGuestsBySessionId: vi.fn() }
})

import { getGuestsUpdatedPayload, emitPartyGuestsUpdated } from './src/services/partyRealtime.mjs'

const SESSION_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('partyRealtime service', () => {
  it('getGuestsUpdatedPayload returns connected count from repo', async () => {
    partyGuests.countConnectedGuestsBySessionId.mockResolvedValue(5)
    const p = { query: async () => ({ rows: [] }) }
    const o = await getGuestsUpdatedPayload(SESSION_ID, /** @type {any} */ (p))
    expect(o).toEqual({ connectedGuestCount: 5 })
  })

  it('emitPartyGuestsUpdated emits to party room with payload', async () => {
    partyGuests.countConnectedGuestsBySessionId.mockResolvedValue(2)
    const emit = vi.fn()
    const to = vi.fn().mockReturnValue({ emit })
    const io = /** @type {import('socket.io').Server} */ (/** @type {unknown} */ ({ to }))
    const getPool = () => (/** @type {import('pg').Pool} */ (/** @type {any} */ ({})))
    await emitPartyGuestsUpdated(io, SESSION_ID, getPool)
    expect(to).toHaveBeenCalledWith(`party:${SESSION_ID}`)
    expect(emit).toHaveBeenCalledWith('guests:updated', { connectedGuestCount: 2 })
  })
})
