import { countConnectedGuestsBySessionId } from '../db/repos/partyGuestsRepo.mjs'
import { listConnectedGuestSummariesBySessionId } from '../db/repos/partyGuestsRepo.mjs'
import { buildPartyKaraokeState } from './partyKaraokeState.mjs'

/**
 * @param {string} sessionId
 */
export function getPartySocketRoomName(sessionId) {
  return `party:${sessionId}`
}

/**
 * @param {import('socket.io').Server | null | undefined} io
 * @param {() => import('pg').Pool | null} getPool
 * @param {string} sessionId
 * @param {'control:requested' | 'control:approved' | 'control:rejected' | 'control:revoked'} eventName
 * @param {Record<string, unknown>} [eventBody]
 */
export async function emitControlAndPartyState(io, getPool, sessionId, eventName, eventBody) {
  const pool = getPool()
  if (!io || !pool) return
  const room = getPartySocketRoomName(sessionId)
  const state = await buildPartyKaraokeState(sessionId, pool, {})
  io.to(room).emit(eventName, {
    sessionId,
    ...(eventBody || {})
  })
  if (state) {
    io.to(room).emit('party:state', state)
  }
}

/**
 * Broadcasts a song/karaoke event, then a full `party:state` payload to the party room.
 * @param {import('socket.io').Server | null | undefined} io
 * @param {() => import('pg').Pool | null} getPool
 * @param {string} sessionId
 * @param {'song:started' | 'song:paused' | 'song:resumed' | 'song:finished'} eventName
 * @param {Record<string, unknown>} [eventBody]
 */
export async function emitPartyKaraokeAndState(io, getPool, sessionId, eventName, eventBody) {
  const pool = getPool()
  if (!io || !pool) return
  const room = getPartySocketRoomName(sessionId)
  const state = await buildPartyKaraokeState(sessionId, pool, {})
  if (!state) {
    return
  }
  io.to(room).emit(eventName, {
    sessionId: state.sessionId,
    ...eventBody
  })
  io.to(room).emit('party:state', state)
}

/**
 * @param {import('socket.io').Server | null | undefined} io
 * @param {() => import('pg').Pool | null} getPool
 * @param {string} sessionId
 * @param {string} action
 * @param {number} [currentLineNumber]
 */
export async function emitLyricsUpdatedAndState(io, getPool, sessionId, action, currentLineNumber) {
  const pool = getPool()
  if (!io || !pool) return
  const room = getPartySocketRoomName(sessionId)
  const state = await buildPartyKaraokeState(sessionId, pool, {})
  if (!state) {
    return
  }
  const n = currentLineNumber != null ? currentLineNumber : state.currentLineNumber
  io.to(room).emit('lyrics:updated', {
    sessionId: String(state.sessionId),
    action,
    currentLineNumber: n
  })
  io.to(room).emit('party:state', state)
}

/**
 * @param {import('socket.io').Server | null | undefined} io
 * @param {string} sessionId
 * @param {Record<string, unknown>} [payload]
 */
export function emitPartyPlaylistUpdated(io, sessionId, payload = {}) {
  if (!io) return
  const room = getPartySocketRoomName(sessionId)
  io.to(room).emit('playlist:updated', {
    sessionId: String(sessionId),
    ...payload
  })
}

/**
 * @param {string} sessionId
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 */
export async function getGuestsUpdatedPayload(sessionId, pool) {
  const c = await countConnectedGuestsBySessionId(sessionId, pool)
  const connectedGuests = await listConnectedGuestSummariesBySessionId(sessionId, pool)
  return { connectedGuestCount: c, connectedGuests }
}

/**
 * @param {import('socket.io').Server} io
 * @param {string} sessionId
 * @param {() => import('pg').Pool | null} getPool
 */
export async function emitPartyGuestsUpdated(io, sessionId, getPool) {
  const pool = getPool()
  if (!pool) return
  const room = getPartySocketRoomName(sessionId)
  const payload = await getGuestsUpdatedPayload(sessionId, pool)
  io.to(room).emit('guests:updated', payload)
}

/**
 * After an admin disables a session: notify clients and push fresh `party:state` (sessionStatus: disabled).
 * @param {import('socket.io').Server | null | undefined} io
 * @param {() => import('pg').Pool | null} getPool
 * @param {string} sessionId
 */
export async function emitAdminPartyDisabled(io, getPool, sessionId) {
  const pool = getPool()
  if (!io || !pool) {
    return
  }
  const room = getPartySocketRoomName(sessionId)
  const state = await buildPartyKaraokeState(sessionId, pool, {})
  const body = { sessionId: String(sessionId), source: 'admin' }
  io.to(room).emit('party:disabled', body)
  io.to(room).emit('party:ended', body)
  if (state) {
    io.to(room).emit('party:state', state)
  }
}

/**
 * After host ends the party: notify all clients; `party:state` shows sessionStatus `ended`.
 * @param {import('socket.io').Server | null | undefined} io
 * @param {() => import('pg').Pool | null} getPool
 * @param {string} sessionId
 */
export async function emitHostPartyEnded(io, getPool, sessionId) {
  const pool = getPool()
  if (!io || !pool) {
    return
  }
  const room = getPartySocketRoomName(sessionId)
  const state = await buildPartyKaraokeState(sessionId, pool, {})
  const body = { sessionId: String(sessionId), source: 'host' }
  io.to(room).emit('party:ended', body)
  if (state) {
    io.to(room).emit('party:state', state)
  }
}
