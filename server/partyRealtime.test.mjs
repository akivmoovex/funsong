import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as partyGuests from './src/db/repos/partyGuestsRepo.mjs'

vi.mock('./src/db/repos/partyGuestsRepo.mjs', async (importOriginal) => {
  const m = await importOriginal()
  return {
    ...m,
    countConnectedGuestsBySessionId: vi.fn(),
    listConnectedGuestSummariesBySessionId: vi.fn()
  }
})

import {
  getGuestsUpdatedPayload,
  emitPartyGuestsUpdated,
  emitPartyPlaylistUpdated
} from './src/services/partyRealtime.mjs'

const SESSION_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('partyRealtime service', () => {
  it('getGuestsUpdatedPayload returns connected count from repo', async () => {
    partyGuests.countConnectedGuestsBySessionId.mockResolvedValue(5)
    partyGuests.listConnectedGuestSummariesBySessionId.mockResolvedValue([
      { id: 'g1', displayName: 'A' },
      { id: 'g2', displayName: 'B' }
    ])
    const p = { query: async () => ({ rows: [] }) }
    const o = await getGuestsUpdatedPayload(SESSION_ID, /** @type {any} */ (p))
    expect(o).toEqual({
      connectedGuestCount: 5,
      connectedGuests: [
        { id: 'g1', displayName: 'A' },
        { id: 'g2', displayName: 'B' }
      ]
    })
  })

  it('emitPartyGuestsUpdated emits to party room with payload', async () => {
    partyGuests.countConnectedGuestsBySessionId.mockResolvedValue(2)
    partyGuests.listConnectedGuestSummariesBySessionId.mockResolvedValue([
      { id: 'g1', displayName: 'Guest One' },
      { id: 'g2', displayName: 'Guest Two' }
    ])
    const emit = vi.fn()
    const to = vi.fn().mockReturnValue({ emit })
    const io = /** @type {import('socket.io').Server} */ (/** @type {unknown} */ ({ to }))
    const getPool = () => (/** @type {import('pg').Pool} */ (/** @type {any} */ ({})))
    await emitPartyGuestsUpdated(io, SESSION_ID, getPool)
    expect(to).toHaveBeenCalledWith(`party:${SESSION_ID}`)
    expect(emit).toHaveBeenCalledWith('guests:updated', {
      connectedGuestCount: 2,
      connectedGuests: [
        { id: 'g1', displayName: 'Guest One' },
        { id: 'g2', displayName: 'Guest Two' }
      ]
    })
  })

  it('emitPartyPlaylistUpdated emits to party room', async () => {
    const emit = vi.fn()
    const to = vi.fn().mockReturnValue({ emit })
    const io = /** @type {import('socket.io').Server} */ (/** @type {unknown} */ ({ to }))
    emitPartyPlaylistUpdated(io, SESSION_ID, { source: 'host:add' })
    expect(to).toHaveBeenCalledWith(`party:${SESSION_ID}`)
    expect(emit).toHaveBeenCalledWith('playlist:updated', {
      sessionId: SESSION_ID,
      source: 'host:add'
    })
  })
})
