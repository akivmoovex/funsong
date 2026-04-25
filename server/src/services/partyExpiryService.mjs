import { rejectAllPendingForSession } from '../db/repos/controlRequestsRepo.mjs'
import { appendEvent } from '../db/repos/partyEventsRepo.mjs'
import { getIntSetting } from './appSettingsService.mjs'
import { buildPartyKaraokeState } from './partyKaraokeState.mjs'
import { getPartySocketRoomName } from './partyRealtime.mjs'
import { logRealtimeEvent } from './realtimeDebug.mjs'

/** @type {boolean | null} */
let hasStartedAtColumn = null
/** @type {boolean | null} */
let hasEndedAtColumn = null

/**
 * @param {import('pg').Pool | import('pg').PoolClient} p
 * @param {string} columnName
 */
async function hasPartySessionsColumn(p, columnName) {
  const { rows } = await p.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'party_sessions'
        AND column_name = $1
      LIMIT 1`,
    [columnName]
  )
  return rows.length > 0
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} p
 */
async function getHasStartedAtColumn(p) {
  if (hasStartedAtColumn == null) {
    hasStartedAtColumn = await hasPartySessionsColumn(p, 'started_at')
  }
  return hasStartedAtColumn
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} p
 */
async function getHasEndedAtColumn(p) {
  if (hasEndedAtColumn == null) {
    hasEndedAtColumn = await hasPartySessionsColumn(p, 'ended_at')
  }
  return hasEndedAtColumn
}

/**
 * @param {{ started_at?: string | Date | null; created_at?: string | Date | null }} session
 */
function getSessionAnchorTime(session) {
  const started = session?.started_at ? new Date(session.started_at) : null
  if (started && Number.isFinite(started.getTime())) {
    return started
  }
  const created = session?.created_at ? new Date(session.created_at) : null
  return created && Number.isFinite(created.getTime()) ? created : null
}

/**
 * @param {{ started_at?: string | Date | null; created_at?: string | Date | null }} session
 * @param {number} autoCloseMinutes
 * @param {Date} now
 */
export function isSessionExpiredByTime(session, autoCloseMinutes, now = new Date()) {
  const anchor = getSessionAnchorTime(session)
  if (!anchor) return false
  const ageMs = now.getTime() - anchor.getTime()
  return ageMs >= autoCloseMinutes * 60 * 1000
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} p
 */
async function listOpenSessionsForExpiryCheck(p) {
  const includeStartedAt = await getHasStartedAtColumn(p)
  const startedAtSql = includeStartedAt ? ', started_at' : ''
  const { rows } = await p.query(
    `SELECT id, status, created_at${startedAtSql}
       FROM party_sessions
      WHERE status IN ('approved'::party_session_status, 'active'::party_session_status)`
  )
  return rows
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} p
 * @param {{ sessionId?: string; partyCode?: string; partyRequestId?: string }} key
 */
async function findOpenSessionByKey(p, key) {
  if (key.sessionId) {
    const includeStartedAt = await getHasStartedAtColumn(p)
    const startedAtSql = includeStartedAt ? ', started_at' : ''
    const { rows } = await p.query(
      `SELECT id, party_code, party_request_id, status, created_at${startedAtSql}
         FROM party_sessions
        WHERE id = $1::uuid
          AND status IN ('approved'::party_session_status, 'active'::party_session_status)
        LIMIT 1`,
      [key.sessionId]
    )
    return rows[0] || null
  }
  if (key.partyCode) {
    const includeStartedAt = await getHasStartedAtColumn(p)
    const startedAtSql = includeStartedAt ? ', started_at' : ''
    const { rows } = await p.query(
      `SELECT id, party_code, party_request_id, status, created_at${startedAtSql}
         FROM party_sessions
        WHERE party_code = $1::text
          AND status IN ('approved'::party_session_status, 'active'::party_session_status)
        LIMIT 1`,
      [key.partyCode]
    )
    return rows[0] || null
  }
  if (key.partyRequestId) {
    const includeStartedAt = await getHasStartedAtColumn(p)
    const startedAtSql = includeStartedAt ? ', started_at' : ''
    const { rows } = await p.query(
      `SELECT id, party_code, party_request_id, status, created_at${startedAtSql}
         FROM party_sessions
        WHERE party_request_id = $1::uuid
          AND status IN ('approved'::party_session_status, 'active'::party_session_status)
        LIMIT 1`,
      [key.partyRequestId]
    )
    return rows[0] || null
  }
  return null
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ sessionId: string; reason: string; now?: Date }} p
 */
async function closeSessionAsExpired(pool, p) {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const includeStartedAt = await getHasStartedAtColumn(c)
    const startedAtSql = includeStartedAt ? ', started_at' : ''
    const { rows } = await c.query(
      `SELECT id, status, created_at${startedAtSql}
         FROM party_sessions
        WHERE id = $1::uuid
        FOR UPDATE`,
      [p.sessionId]
    )
    const session = rows[0]
    if (!session) {
      await c.query('ROLLBACK')
      return null
    }
    const status = String(session.status || '')
    if (status !== 'approved' && status !== 'active') {
      await c.query('ROLLBACK')
      return null
    }
    const autoCloseMinutes = await getIntSetting('party_auto_close_minutes', 300, c)
    if (!isSessionExpiredByTime(session, autoCloseMinutes, p.now || new Date())) {
      await c.query('ROLLBACK')
      return null
    }
    const includeEndedAt = await getHasEndedAtColumn(c)
    const endedAtSql = includeEndedAt ? ', ended_at = now()' : ''
    const { rows: updatedRows } = await c.query(
      `UPDATE party_sessions
          SET status = 'ended'::party_session_status,
              playback_status = 'idle'::playback_status,
              active_song_id = NULL,
              active_playlist_item_id = NULL,
              current_line_number = NULL,
              current_controller_party_guest_id = NULL,
              controller_audio_enabled = FALSE,
              updated_at = now()
              ${endedAtSql}
        WHERE id = $1::uuid
        RETURNING *`,
      [p.sessionId]
    )
    const updated = updatedRows[0]
    if (!updated) {
      await c.query('ROLLBACK')
      return null
    }
    await rejectAllPendingForSession(String(updated.id), c)
    try {
      await appendEvent(
        {
          sessionId: String(updated.id),
          eventType: 'party_expired',
          payload: { source: 'auto_close', reason: p.reason }
        },
        c
      )
    } catch {
      // ignore logging failures
    }
    await c.query('COMMIT')
    return updated
  } catch (e) {
    try {
      await c.query('ROLLBACK')
    } catch {
      // ignore
    }
    throw e
  } finally {
    c.release()
  }
}

/**
 * @param {import('socket.io').Server | null | undefined} io
 * @param {() => import('pg').Pool | null} getPool
 * @param {string} sessionId
 */
export async function emitPartyExpired(io, getPool, sessionId) {
  const pool = getPool()
  if (!io || !pool) {
    return
  }
  const room = getPartySocketRoomName(sessionId)
  const state = await buildPartyKaraokeState(sessionId, pool, {})
  const payload = { sessionId: String(sessionId), source: 'auto_close' }
  logRealtimeEvent('party:expired', {
    sessionId: String(sessionId),
    source: 'auto_close'
  })
  io.to(room).emit('party:expired', payload)
  io.to(room).emit('party:ended', payload)
  if (state) {
    io.to(room).emit('party:state', state)
  }
}

/**
 * @param {{
 *   getPool: () => import('pg').Pool | null
 *   io?: import('socket.io').Server | null
 *   now?: Date
 }} d
 */
export async function closeExpiredParties(d) {
  const pool = d.getPool()
  if (!pool || typeof pool.query !== 'function') {
    return { checked: 0, closed: 0, closedSessionIds: [] }
  }
  const now = d.now || new Date()
  const autoCloseMinutes = await getIntSetting('party_auto_close_minutes', 300, pool)
  const openSessions = await listOpenSessionsForExpiryCheck(pool)
  const expired = openSessions.filter((s) => isSessionExpiredByTime(s, autoCloseMinutes, now))
  const closedIds = []
  for (const session of expired) {
    const closed = await closeSessionAsExpired(pool, {
      sessionId: String(session.id),
      reason: 'interval',
      now
    })
    if (closed) {
      closedIds.push(String(closed.id))
      await emitPartyExpired(d.io, d.getPool, String(closed.id))
    }
  }
  return { checked: openSessions.length, closed: closedIds.length, closedSessionIds: closedIds }
}

/**
 * @param {{
 *   getPool: () => import('pg').Pool | null
 *   io?: import('socket.io').Server | null
 *   now?: Date
 *   sessionId?: string
 *   partyCode?: string
 *   partyRequestId?: string
 }} d
 */
export async function ensurePartyNotExpired(d) {
  const pool = d.getPool()
  if (!pool || typeof pool.query !== 'function') {
    return { checked: false, expired: false, closedSessionId: null }
  }
  const key = {
    sessionId: d.sessionId,
    partyCode: d.partyCode,
    partyRequestId: d.partyRequestId
  }
  const session = await findOpenSessionByKey(pool, key)
  if (!session) {
    return { checked: true, expired: false, closedSessionId: null }
  }
  const autoCloseMinutes = await getIntSetting('party_auto_close_minutes', 300, pool)
  const expired = isSessionExpiredByTime(session, autoCloseMinutes, d.now || new Date())
  if (!expired) {
    return { checked: true, expired: false, closedSessionId: null }
  }
  const closed = await closeSessionAsExpired(pool, {
    sessionId: String(session.id),
    reason: 'lazy_check',
    now: d.now || new Date()
  })
  if (closed) {
    await emitPartyExpired(d.io, d.getPool, String(closed.id))
    return { checked: true, expired: true, closedSessionId: String(closed.id) }
  }
  return { checked: true, expired: false, closedSessionId: null }
}

const EXPIRY_JOB_KEY = '__funsongPartyExpiryInterval'

/**
 * @param {{
 *   getPool: () => import('pg').Pool | null
 *   getIo?: () => import('socket.io').Server | null | undefined
 *   intervalMs?: number
 }} d
 */
export function startPartyExpiryInterval(d) {
  if (process.env.NODE_ENV === 'test') {
    return null
  }
  if (globalThis[EXPIRY_JOB_KEY]) {
    return globalThis[EXPIRY_JOB_KEY]
  }
  const intervalMs = Number.isFinite(d.intervalMs) ? Number(d.intervalMs) : 60_000
  const timer = setInterval(() => {
    void closeExpiredParties({
      getPool: d.getPool,
      io: d.getIo ? d.getIo() || null : null
    }).catch(() => {
      // ignore background auto-close errors to avoid process crash
    })
  }, intervalMs)
  if (typeof timer.unref === 'function') {
    timer.unref()
  }
  const handle = {
    stop() {
      clearInterval(timer)
      globalThis[EXPIRY_JOB_KEY] = null
    }
  }
  globalThis[EXPIRY_JOB_KEY] = handle
  return handle
}
