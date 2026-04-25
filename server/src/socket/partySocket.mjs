import { Server } from 'socket.io'
import { readGuestTokenFromRequest } from '../guest/cookies.mjs'
import { findUserById } from '../db/repos/usersRepo.mjs'
import { findSessionById } from '../db/repos/partySessionsRepo.mjs'
import {
  findGuestById,
  findGuestByTokenForSessionId,
  updatePartyGuestConnectionState
} from '../db/repos/partyGuestsRepo.mjs'
import { appendEvent } from '../db/repos/partyEventsRepo.mjs'
import {
  emitLyricsUpdatedAndState,
  emitPartyGuestsUpdated,
  emitPartyKaraokeAndState,
  getPartySocketRoomName
} from '../services/partyRealtime.mjs'
import { buildPartyKaraokeState } from '../services/partyKaraokeState.mjs'
import { applyLyricLineAction, canControlLyrics } from '../services/lyricLineControl.mjs'
import { applyPartyAudioPlaybackOp, canControlPartyAudio } from '../services/partyAudioControl.mjs'
import { sessionAllowsLivePartyControl } from '../services/partySessionPolicy.mjs'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {import('express').RequestHandler} sessionMiddleware
 */
function wrapSessionForSocketIO(sessionMiddleware) {
  return (/** @type {import('socket.io').Socket} */ socket, next) => {
    const req = socket.request
    const res = {
      getHeader: () => {},
      setHeader: () => {},
      end: () => {},
      writeHead: () => {},
      on: (ev, fn) => {
        if (ev === 'finish' && fn) {
          setImmediate(() => {
            try {
              fn()
            } catch {
              // ignore
            }
          })
        }
      }
    }
    sessionMiddleware(req, res, next)
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
function sessionIsLiveForHostOrGuest(row) {
  if (!row) return false
  const s = /** @type {string} */ (row.status)
  return s === 'approved' || s === 'active'
}

/**
 * @param {{
 *   getPool: () => import('pg').Pool | null
 *   partySessionId: string
 *   role: 'guest' | 'host' | 'admin'
 *   guestToken: string | null
 *   session: import('express').Session & { userId?: string } | null | undefined
 * }} a
 * @returns {Promise<
 *   | { ok: true; role: 'guest' | 'host' | 'admin'; sessionRow: Record<string, unknown>; guest: Record<string, unknown> | null; user: Record<string, unknown> | null }
 *   | { ok: false; error: string }
 * >}
 */
export async function verifyPartySocketAccess(a) {
  const pool = a.getPool()
  if (!pool) {
    return { ok: false, error: 'no_database' }
  }
  if (!UUID.test(a.partySessionId)) {
    return { ok: false, error: 'invalid_session' }
  }
  if (a.role !== 'guest' && a.role !== 'host' && a.role !== 'admin') {
    return { ok: false, error: 'invalid_role' }
  }
  const row = await findSessionById(a.partySessionId, pool)
  if (!row) {
    return { ok: false, error: 'not_found' }
  }

  if (a.role === 'admin') {
    const s = a.session
    if (!s?.userId) {
      return { ok: false, error: 'unauthorized' }
    }
    const user = await findUserById(s.userId, pool)
    if (!user || user.is_active === false) {
      return { ok: false, error: 'unauthorized' }
    }
    if (user.role !== 'super_admin') {
      return { ok: false, error: 'forbidden' }
    }
    return { ok: true, role: 'admin', sessionRow: row, guest: null, user }
  }

  if (a.role === 'host') {
    const s = a.session
    if (!s?.userId) {
      return { ok: false, error: 'unauthorized' }
    }
    const user = await findUserById(s.userId, pool)
    if (!user || user.is_active === false) {
      return { ok: false, error: 'unauthorized' }
    }
    if (user.role !== 'host' && user.role !== 'super_admin') {
      return { ok: false, error: 'forbidden' }
    }
    if (String(row.host_id) !== String(user.id)) {
      return { ok: false, error: 'forbidden' }
    }
    if (!sessionIsLiveForHostOrGuest(row)) {
      return { ok: false, error: 'not_available' }
    }
    return { ok: true, role: 'host', sessionRow: row, guest: null, user }
  }

  // guest
  if (!a.guestToken) {
    return { ok: false, error: 'no_guest_token' }
  }
  if (!sessionIsLiveForHostOrGuest(row)) {
    return { ok: false, error: 'not_available' }
  }
  const guest = await findGuestByTokenForSessionId(a.guestToken, a.partySessionId, pool)
  if (!guest) {
    return { ok: false, error: 'invalid_guest' }
  }
  return { ok: true, role: 'guest', sessionRow: row, guest, user: null }
}

/**
 * @param {import('node:http').Server} httpServer
 * @param {{
 *   getPool: () => import('pg').Pool | null
 *   sessionMiddleware: import('express').RequestHandler
 *   clientOrigins?: (string | RegExp)[]
 * }} opts
 * @returns {import('socket.io').Server}
 */
export function attachPartySocketIo(httpServer, opts) {
  const { getPool, sessionMiddleware, clientOrigins = defaultOrigins() } = opts
  const io = new Server(httpServer, {
    path: '/socket.io',
    serveClient: false,
    cors: {
      origin: (/** @type {string | undefined} */ origin, callback) => {
        if (origin == null) {
          return callback(null, true)
        }
        for (const o of clientOrigins) {
          if (typeof o === 'string' && o === origin) {
            return callback(null, true)
          }
          if (o instanceof RegExp && o.test(origin)) {
            return callback(null, true)
          }
        }
        return callback(null, false)
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  })
  const wrapSess = wrapSessionForSocketIO(sessionMiddleware)
  io.use(wrapSess)
  io.use((socket, next) => {
    const auth = /** @type {Record<string, unknown>} */ (socket.handshake.auth) || {}
    const partySessionId = String(auth.partySessionId || '')
    const roleRaw = String(auth.role || '') || ''
    if (!['guest', 'host', 'admin'].includes(roleRaw)) {
      return next(new Error('invalid_handshake'))
    }
    const role = /** @type {'guest' | 'host' | 'admin'} */ (roleRaw)
    const session = /** @type {import('express').Request & { session: import('express').Session } } */ (socket
      .request).session
    const guestTokenFromAuth = auth.guestToken ? String(auth.guestToken) : ''
    const guestFromCookie = readGuestTokenFromRequest(/** @type {any} */ (socket.request))
    const guestToken = guestTokenFromAuth || guestFromCookie

    const run = () =>
      verifyPartySocketAccess({
        getPool,
        partySessionId,
        role,
        guestToken: role === 'guest' ? guestToken : null,
        session
      })

    ;(async () => {
      try {
        const out = await run()
        if (!out.ok) {
          return next(new Error(out.error))
        }
        socket.data.partySessionId = String(out.sessionRow.id)
        socket.data.partySocketRole = out.role
        socket.data.partyGuestId = out.guest?.id || null
        socket.data.partyUserId = out.user?.id || null
        return next()
      } catch (e) {
        return next(e instanceof Error ? e : new Error('socket_auth'))
      }
    })()
  })
  const poolOrThrow = () => {
    const p = getPool()
    if (!p) {
      return null
    }
    return p
  }

  async function buildPartyStatePayload(
    /** @type {string} */ sessionId,
    /** @type {string} */ r,
    /** @type {string | null | undefined} */ partyGuestId
  ) {
    const pool = poolOrThrow()
    if (!pool) {
      return { sessionId, role: r, connectedGuestCount: 0, sessionStatus: null }
    }
    let lang = /** @type {'english' | 'hindi' | 'hebrew'} */ ('english')
    if (r === 'guest' && partyGuestId) {
      const g = await findGuestById(String(partyGuestId), pool)
      const lp = g && String(/** @type {any} */ (g).language_preference || 'english')
      if (lp === 'hindi' || lp === 'hebrew' || lp === 'english') {
        lang = lp
      }
    }
    const full = await buildPartyKaraokeState(sessionId, pool, { role: r, languagePreference: lang })
    return full || { sessionId, role: r, connectedGuestCount: 0, sessionStatus: null }
  }

  async function onAuthenticatedConnection(socket) {
    const sessionId = /** @type {string} */ (socket.data.partySessionId)
    const role = /** @type {string} */ (socket.data.partySocketRole)
    const room = getPartySocketRoomName(sessionId)
    const pool = poolOrThrow()
    if (!pool) {
      return
    }
    if (role === 'guest' && socket.data.partyGuestId) {
      await updatePartyGuestConnectionState(socket.data.partyGuestId, { isConnected: true }, pool)
      try {
        await appendEvent(
          {
            sessionId,
            eventType: 'realtime:guest_connect',
            payload: { source: 'socket' },
            createdByPartyGuestId: socket.data.partyGuestId
          },
          pool
        )
      } catch (e) {
        console.error(e)
      }
    } else if (role === 'host') {
      try {
        await appendEvent(
          {
            sessionId,
            eventType: 'realtime:host_connect',
            payload: { source: 'socket' }
          },
          pool
        )
      } catch (e) {
        console.error(e)
      }
    } else if (role === 'admin') {
      try {
        await appendEvent(
          {
            sessionId,
            eventType: 'realtime:admin_connect',
            payload: { source: 'socket' }
          },
          pool
        )
      } catch (e) {
        console.error(e)
      }
    }
    await socket.join(room)
    const state = await buildPartyStatePayload(sessionId, role, socket.data.partyGuestId)
    socket.emit('party:state', state)
    if (['guest', 'host', 'admin'].includes(role)) {
      try {
        await emitPartyGuestsUpdated(io, sessionId, getPool)
      } catch (e) {
        console.error(e)
      }
    }
  }

  io.on('connection', (socket) => {
    onAuthenticatedConnection(socket).catch((e) => {
      console.error(e)
    })

    socket.on('party:join', (cb) => {
      const sessionId = String(socket.data.partySessionId || '')
      const role = String(socket.data.partySocketRole || '')
      buildPartyStatePayload(sessionId, role, socket.data.partyGuestId)
        .then((state) => {
          socket.emit('party:state', state)
          if (typeof cb === 'function') {
            try {
              cb(null, state)
            } catch (e) {
              console.error(e)
            }
          }
        })
        .catch((e) => {
          if (typeof cb === 'function') {
            try {
              cb(e, null)
            } catch (err) {
              console.error(err)
            }
          }
        })
    })

    async function handleLyricAction(
      /** @type {'next' | 'previous' | 'restart' | 'jump' | 'finish'} */ action,
      /** @type {Record<string, unknown> | undefined} */ payload
    ) {
      try {
        const pool = poolOrThrow()
        if (!pool) {
          return
        }
        const sessionId = String(socket.data.partySessionId || '')
        const session = await findSessionById(sessionId, pool)
        if (!session) {
          return socket.emit('lyrics:error', { error: 'not_found' })
        }
        if (!sessionAllowsLivePartyControl(session)) {
          return socket.emit('lyrics:error', { error: 'session_closed' })
        }
        if (!canControlLyrics(session, {
          role: /** @type {'guest' | 'host' | 'admin'} */ (socket.data.partySocketRole),
          partyGuestId: socket.data.partyGuestId || null
        })) {
          return socket.emit('lyrics:error', { error: 'forbidden' })
        }
        const out = await applyLyricLineAction(pool, sessionId, action, payload || {})
        if (!out.ok) {
          return socket.emit('lyrics:error', { error: out.error })
        }
        if (out.finished) {
          await emitPartyKaraokeAndState(io, getPool, sessionId, 'song:finished', {
            source: 'lyrics',
            action
          })
          return
        }
        await emitLyricsUpdatedAndState(io, getPool, sessionId, action, out.currentLineNumber)
      } catch (e) {
        console.error(e)
        try {
          socket.emit('lyrics:error', { error: 'server_error' })
        } catch {
          // ignore
        }
      }
    }

    socket.on('lyrics:next', () => {
      void handleLyricAction('next', {})
    })
    socket.on('lyrics:previous', () => {
      void handleLyricAction('previous', {})
    })
    socket.on('lyrics:restart', () => {
      void handleLyricAction('restart', {})
    })
    socket.on('lyrics:finish', () => {
      void handleLyricAction('finish', {})
    })
    socket.on('lyrics:jump', (payload) => {
      const p = /** @type {Record<string, unknown>} */ (payload && typeof payload === 'object' ? payload : {})
      void handleLyricAction('jump', p)
    })

    async function handleAudioPlayback(/** @type {'pause' | 'resume'} */ op) {
      try {
        const pool = poolOrThrow()
        if (!pool) {
          return
        }
        const sessionId = String(socket.data.partySessionId || '')
        const session = await findSessionById(sessionId, pool)
        if (!session) {
          return socket.emit('audio:error', { error: 'not_found' })
        }
        if (!sessionAllowsLivePartyControl(session)) {
          return socket.emit('audio:error', { error: 'session_closed' })
        }
        if (
          !canControlPartyAudio(session, {
            role: /** @type {'guest' | 'host' | 'admin'} */ (socket.data.partySocketRole),
            partyGuestId: socket.data.partyGuestId || null
          })
        ) {
          return socket.emit('audio:error', { error: 'forbidden' })
        }
        if (!/** @type {any} */ (session).active_song_id) {
          return socket.emit('audio:error', { error: 'no_active_song' })
        }
        const out = await applyPartyAudioPlaybackOp(pool, sessionId, op)
        if (!out.ok) {
          return socket.emit('audio:error', { error: out.error })
        }
        const eventName = op === 'pause' ? 'song:paused' : 'song:resumed'
        await emitPartyKaraokeAndState(io, getPool, sessionId, eventName, {
          playbackStatus: op === 'pause' ? 'paused' : 'playing'
        })
      } catch (e) {
        console.error(e)
        try {
          socket.emit('audio:error', { error: 'server_error' })
        } catch {
          // ignore
        }
      }
    }

    socket.on('audio:pause', () => {
      void handleAudioPlayback('pause')
    })
    socket.on('audio:resume', () => {
      void handleAudioPlayback('resume')
    })

    socket.on('disconnect', () => {
      const sessionId = String(socket.data.partySessionId || '')
      const role = String(socket.data.partySocketRole || '')
      const guestId = socket.data.partyGuestId
      if (!sessionId) return
      const pool = poolOrThrow()
      if (!pool) {
        return
      }
      ;(async () => {
        if (role === 'guest' && guestId) {
          try {
            await updatePartyGuestConnectionState(/** @type {string} */ (guestId), { isConnected: false }, pool)
            await appendEvent(
              {
                sessionId,
                eventType: 'realtime:guest_disconnect',
                payload: { source: 'socket' },
                createdByPartyGuestId: /** @type {string} */ (guestId)
              },
              pool
            )
            await emitPartyGuestsUpdated(io, sessionId, getPool)
          } catch (e) {
            console.error(e)
          }
        }
      })().catch((e) => console.error(e))
    })
  })
  return io
}

/**
 * @returns {(string | RegExp)[]}
 */
function defaultOrigins() {
  const env = (process.env.PARTY_SOCKET_CORS || process.env.VITE_DEV_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (env.length) {
    return env
  }
  return [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i]
}
