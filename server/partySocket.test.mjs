import { describe, expect, it } from 'vitest'
import http from 'node:http'
import session from 'express-session'
import { io as ioc } from 'socket.io-client'
import { buildSession } from './src/middleware/buildSession.mjs'
import { createApp } from './src/app.mjs'
import { attachPartySocketIo, verifyPartySocketAccess } from './src/socket/partySocket.mjs'

const SESSION_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const GUEST_ID = 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'
const HOST_ID = 'a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'

function makePool(overrides = {}) {
  const sessionRow = { id: SESSION_ID, host_id: HOST_ID, status: 'active' }
  return {
    query: async (/** @type {string} */ sql, /** @type {unknown[]} */ params) => {
      const s = String(sql)
      if (s.includes('FROM users') && s.includes('WHERE id =')) {
        if (String(params[0]) === HOST_ID) {
          return { rows: [overrides.user || { id: params[0], role: 'host', is_active: true }] }
        }
        if (String(params[0]) === 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10') {
          return {
            rows: [
              overrides.user ||
                { id: params[0], role: 'super_admin', is_active: true }
            ]
          }
        }
        return { rows: [] }
      }
      if (s.includes('SELECT * FROM party_sessions') && s.includes('WHERE id = $1::uuid') && !s.includes('JOIN')) {
        if (String(params[0]) === SESSION_ID) {
          return { rows: [overrides.session || sessionRow] }
        }
        return { rows: [] }
      }
      if (s.includes('FROM party_guests g') && s.includes('INNER JOIN party_sessions')) {
        if (params[0] === 'goodtok' && String(params[1]) === SESSION_ID) {
          return {
            rows: [
              overrides.guest || {
                id: GUEST_ID,
                display_name: 'A',
                session_id: SESSION_ID
              }
            ]
          }
        }
        return { rows: [] }
      }
      if (s.toLowerCase().includes('count(*)') && s.includes('is_connected')) {
        return { rows: [{ c: 1 }] }
      }
      if (s.includes('UPDATE party_guests')) {
        return { rows: [overrides.guestRes || { id: params[0] }] }
      }
      if (s.includes('INSERT INTO party_events')) {
        return { rows: [{ id: 'e1' }] }
      }
      return { rows: [] }
    }
  }
}

describe('verifyPartySocketAccess', () => {
  it('fails for guest with no token', async () => {
    const pool = makePool()
    const o = await verifyPartySocketAccess({
      getPool: () => /** @type {import('pg').Pool} */ (/** @type {any} */ (pool)),
      partySessionId: SESSION_ID,
      role: 'guest',
      guestToken: null,
      session: /** @type {import('express').Session} */ (/** @type {any} */ ({}))
    })
    expect(o.ok).toBe(false)
  })

  it('fails for guest when session is disabled (no realtime join)', async () => {
    const pool = makePool({
      session: { id: SESSION_ID, host_id: HOST_ID, status: 'disabled' }
    })
    const o = await verifyPartySocketAccess({
      getPool: () => /** @type {import('pg').Pool} */ (/** @type {any} */ (pool)),
      partySessionId: SESSION_ID,
      role: 'guest',
      guestToken: 'goodtok',
      session: /** @type {import('express').Session} */ (/** @type {any} */ ({}))
    })
    expect(o.ok).toBe(false)
    if (o.ok === false) {
      expect(o.error).toBe('not_available')
    }
  })
})

describe('Socket.IO party room', () => {
  it('rejects guest with invalid token', async () => {
    const pool = makePool()
    const mem = new session.MemoryStore()
    const getPool = () => /** @type {import('pg').Pool} */ (/** @type {any} */ (pool))
    const sm = buildSession({ getPool, sessionStore: mem, sessionSecret: 't' })
    const app = createApp({ getPool, sessionMiddleware: sm })
    const httpServer = http.createServer(app)
    attachPartySocketIo(httpServer, { getPool, sessionMiddleware: sm })
    await new Promise((r) => {
      httpServer.listen(0, r)
    })
    const p = httpServer.address()
    const port = /** @type {import('node:net').AddressInfo} */ (p).port
    const url = `http://127.0.0.1:${port}`
    const c = ioc(url, {
      path: '/socket.io',
      auth: { partySessionId: SESSION_ID, role: 'guest', guestToken: 'bad' }
    })
    await new Promise((resolve) => {
      c.on('connect_error', (err) => {
        try {
          expect(String(err && err.message)).toMatch(/invalid/)
        } finally {
          c.close()
          httpServer.close(() => resolve())
        }
      })
    })
  }, 10_000)

  it('allows valid guest, sends party:state', async () => {
    const pool = makePool()
    const mem = new session.MemoryStore()
    const getPool = () => /** @type {import('pg').Pool} */ (/** @type {any} */ (pool))
    const sm = buildSession({ getPool, sessionStore: mem, sessionSecret: 't' })
    const app = createApp({ getPool, sessionMiddleware: sm })
    const httpServer = http.createServer(app)
    attachPartySocketIo(httpServer, { getPool, sessionMiddleware: sm })
    await new Promise((r) => {
      httpServer.listen(0, r)
    })
    const p = httpServer.address()
    const port = /** @type {import('node:net').AddressInfo} */ (p).port
    const url = `http://127.0.0.1:${port}`
    const c = ioc(url, {
      path: '/socket.io',
      auth: { partySessionId: SESSION_ID, role: 'guest', guestToken: 'goodtok' }
    })
    await new Promise((resolve) => {
      c.once('party:state', (st) => {
        try {
          expect(st.sessionId).toBe(SESSION_ID)
          expect(st.role).toBe('guest')
          expect(typeof st.connectedGuestCount).toBe('number')
        } finally {
          c.close()
          httpServer.close(() => resolve())
        }
      })
    })
  }, 10_000)
})
