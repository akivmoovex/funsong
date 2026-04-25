import { Router } from 'express'
import { findRequestByIdForHost } from '../db/repos/partyRequestsRepo.mjs'
import { findSessionById, setCurrentControllerGuest } from '../db/repos/partySessionsRepo.mjs'
import * as crRepo from '../db/repos/controlRequestsRepo.mjs'
import { emitControlAndPartyState } from '../services/partyRealtime.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {import('pg').Pool} pool
 * @param {string} requestId
 * @param {string} hostUserId
 * @returns {Promise<
 *   | { ok: true; request: import('pg').QueryResultRow; session: import('pg').QueryResultRow }
 *   | { ok: false; status: number; error: string }
 * >}
 */
async function loadRequestForHost(pool, requestId, hostUserId) {
  if (!UUID.test(requestId)) {
    return { ok: false, status: 400, error: 'invalid_request_id' }
  }
  const row = await crRepo.findById(requestId, pool)
  if (!row) {
    return { ok: false, status: 404, error: 'not_found' }
  }
  const session = await findSessionById(String(/** @type {any} */ (row).session_id), pool)
  if (!session) {
    return { ok: false, status: 404, error: 'no_session' }
  }
  const ss = String(/** @type {any} */ (session).status || '')
  if (ss === 'disabled' || ss === 'ended') {
    return { ok: false, status: 403, error: 'session_disabled' }
  }
  const pr = await findRequestByIdForHost(String(/** @type {any} */ (session).party_request_id), hostUserId, pool)
  if (!pr) {
    return { ok: false, status: 403, error: 'forbidden' }
  }
  if (pr.status !== 'approved') {
    return { ok: false, status: 403, error: 'not_approved' }
  }
  return { ok: true, request: row, session }
}

/**
 * @param {{ getPool: () => import('pg').Pool | null }} d
 */
export function createHostControlRouter(d) {
  const r = Router()

  r.post('/control-requests/:requestId/approve', async (req, res, next) => {
    try {
      const requestId = String(/** @type {any} */ (req.params).requestId || '')
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const u = /** @type {{ id: string }} */ (req.funsongUser)
      const out = await loadRequestForHost(pool, requestId, u.id)
      if (!out.ok) {
        return res.status(out.status).json({ error: out.error })
      }
      const sessionId = String(/** @type {any} */ (out.session).id)
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        const appro = await crRepo.approveRequestById(requestId, u.id, c)
        if (!appro) {
          await c.query('ROLLBACK')
          return res.status(409).json({ error: 'not_pending' })
        }
        await crRepo.rejectOtherPendingForSession(sessionId, requestId, c)
        await setCurrentControllerGuest(sessionId, String(/** @type {any} */ (appro).party_guest_id), c)
        await c.query('COMMIT')
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
      const io = /** @type {import('socket.io').Server | undefined} */ (req.app.get('io'))
      await emitControlAndPartyState(io, d.getPool, sessionId, 'control:approved', {
        requestId,
        partyGuestId: String(/** @type {any} */ (out.request).party_guest_id)
      })
      return res.json({ ok: true })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/control-requests/:requestId/reject', async (req, res, next) => {
    try {
      const requestId = String(/** @type {any} */ (req.params).requestId || '')
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const u = /** @type {{ id: string }} */ (req.funsongUser)
      const out = await loadRequestForHost(pool, requestId, u.id)
      if (!out.ok) {
        return res.status(out.status).json({ error: out.error })
      }
      const sessionId = String(/** @type {any} */ (out.session).id)
      const c = await pool.connect()
      let rej
      try {
        rej = await crRepo.rejectRequestById(requestId, c)
      } finally {
        c.release()
      }
      if (!rej) {
        return res.status(409).json({ error: 'not_pending' })
      }
      const io = /** @type {import('socket.io').Server | undefined} */ (req.app.get('io'))
      await emitControlAndPartyState(io, d.getPool, sessionId, 'control:rejected', {
        requestId,
        partyGuestId: String(/** @type {any} */ (out.request).party_guest_id)
      })
      return res.json({ ok: true })
    } catch (e) {
      return next(e)
    }
  })

  return r
}
