import { Router } from 'express'
import { listPendingRequestsForAdmin } from '../db/repos/partyRequestsRepo.mjs'
import {
  disableSessionById,
  findSessionRowForAdminById,
  listSessionsForAdmin
} from '../db/repos/partySessionsRepo.mjs'
import { appendEvent } from '../db/repos/partyEventsRepo.mjs'
import { emitAdminPartyDisabled } from '../services/partyRealtime.mjs'
import { approvePartyRequest, rejectPartyRequest } from '../services/partyRequestApproval.mjs'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {object} r
 */
function mapPending(r) {
  return {
    id: r.id,
    hostId: r.host_id,
    status: r.status,
    partyName: r.party_name,
    eventDatetime: r.event_datetime,
    expectedGuests: r.expected_guests,
    description: r.description,
    privateUseConfirmed: r.private_use_confirmed === true,
    privateUseConfirmedAt: r.private_use_confirmed_at,
    hostEmail: r.host_email,
    hostDisplayName: r.host_display_name,
    createdAt: r.created_at
  }
}

/**
 * @param {object} r
 */
function mapSession(r) {
  if (!r) {
    return null
  }
  const activeId = r.active_song_id
  return {
    id: r.id,
    partyRequestId: r.party_request_id,
    hostId: r.host_id,
    status: r.status,
    endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null,
    maxGuests: r.max_guests,
    partyName: r.request_party_name,
    hostEmail: r.host_email,
    hostDisplayName: r.host_display_name,
    partyCode: r.party_code,
    requestStatus: r.request_status,
    createdAt: r.created_at,
    connectedGuestCount: Number(r.connected_guests ?? 0),
    activeSong:
      activeId && r.active_song_title
        ? { id: String(activeId), title: String(r.active_song_title) }
        : activeId
          ? { id: String(activeId), title: '—' }
          : null,
    currentController: r.controller_guest_id
      ? {
          id: String(r.controller_guest_id),
          displayName: String(r.controller_display_name || 'Guest')
        }
      : null
  }
}

/**
 * @param {{ getPool: () => import('pg').Pool | null }} d
 */
export function createAdminPartyRequestsRouter(d) {
  const r = Router()

  r.get('/', async (req, res, next) => {
    try {
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const rows = await listPendingRequestsForAdmin(pool)
      return res.json({ partyRequests: rows.map(mapPending) })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:requestId/approve', async (req, res, next) => {
    try {
      if (!UUID.test(String(req.params.requestId || ''))) {
        return res.status(400).json({ error: 'invalid_request_id' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const admin = /** @type {{ id: string }} */ (req.funsongUser)
      const out = await approvePartyRequest(pool, req.params.requestId, admin.id)
      if (!out.ok) {
        if (out.error === 'already_approved') {
          return res.status(409).json({ error: out.error })
        }
        return res.status(404).json({ error: out.error })
      }
      return res.status(201).json({
        session: {
          id: out.session.id,
          partyCode: out.session.party_code,
          maxGuests: out.session.max_guests
        }
      })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:requestId/reject', async (req, res, next) => {
    try {
      if (!UUID.test(String(req.params.requestId || ''))) {
        return res.status(400).json({ error: 'invalid_request_id' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const b = /** @type {Record<string, unknown>} */ (req.body) || {}
      const reason = String(b.reason ?? b.rejectionReason ?? '')
      if (!reason.trim()) {
        return res.status(400).json({ error: 'reason_required' })
      }
      const admin = /** @type {{ id: string }} */ (req.funsongUser)
      const out = await rejectPartyRequest(
        pool,
        req.params.requestId,
        reason,
        admin.id
      )
      if (!out.ok) {
        return res.status(404).json({ error: out.error })
      }
      return res.json({ partyRequest: { id: out.request.id, status: 'rejected' } })
    } catch (e) {
      return next(e)
    }
  })

  return r
}

/**
 * @param {{ getPool: () => import('pg').Pool | null }} d
 */
/**
 * @param {import('express').Request} req
 */
function getSocketIo(/** @type {any} */ req) {
  return /** @type {import('socket.io').Server | undefined} */ (req.app.get('io'))
}

export function createAdminPartiesRouter(d) {
  const r = Router()

  r.get('/', async (req, res, next) => {
    try {
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const rows = await listSessionsForAdmin(pool)
      return res.json({ parties: rows.map(mapSession) })
    } catch (e) {
      return next(e)
    }
  })

  r.get('/:partyId', async (req, res, next) => {
    try {
      if (!UUID.test(String(req.params.partyId || ''))) {
        return res.status(400).json({ error: 'invalid_party_id' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const row = await findSessionRowForAdminById(req.params.partyId, pool)
      if (!row) {
        return res.status(404).json({ error: 'not_found' })
      }
      return res.json({ party: mapSession(row) })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/:partyId/disable', async (req, res, next) => {
    try {
      if (!UUID.test(String(req.params.partyId || ''))) {
        return res.status(400).json({ error: 'invalid_party_id' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const sessionId = req.params.partyId
      const row = await disableSessionById(sessionId, pool)
      if (!row) {
        return res.status(404).json({ error: 'not_found' })
      }
      const admin = /** @type {{ id: string }} */ (req.funsongUser)
      try {
        await appendEvent(
          {
            sessionId,
            eventType: 'admin:party_disabled',
            payload: { adminUserId: admin.id, source: 'api' }
          },
          pool
        )
      } catch {
        // ignore log failure
      }
      const io = getSocketIo(req)
      await emitAdminPartyDisabled(io, d.getPool, String(row.id))
      return res.json({ party: { id: row.id, status: row.status } })
    } catch (e) {
      return next(e)
    }
  })

  return r
}
