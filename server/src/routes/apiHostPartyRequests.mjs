import { Router } from 'express'
import {
  createRequest,
  findRequestById,
  findRequestByIdForHost,
  listRequestsByHostId
} from '../db/repos/partyRequestsRepo.mjs'
import { findSessionByPartyRequestId } from '../db/repos/partySessionsRepo.mjs'
import { approvePartyRequest } from '../services/partyRequestApproval.mjs'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {{ getPool: () => import('pg').Pool | null }} d
 */
function makeMapRequest(d) {
  return async function mapRequestRow(req, row) {
    if (!row) return null
    const pool = d.getPool()
    const session =
      row.status === 'approved' && pool
        ? await findSessionByPartyRequestId(row.id, pool)
        : null
    const code = session ? session.party_code || session.join_code : null
    const canShowJoin = Boolean(
      row.status === 'approved' &&
        session &&
        session.status !== 'disabled' &&
        session.status !== 'ended' &&
        code &&
        String(code).length > 0
    )
    const joinPath = canShowJoin && code ? `/join/${encodeURIComponent(String(code))}` : null
    const base = req.get('host')
      ? `${req.protocol}://${req.get('host')}`
      : ''
    const joinUrl = joinPath && base ? `${base}${joinPath}` : joinPath
    return {
      id: row.id,
      status: row.status,
      partyName: row.party_name,
      eventDatetime: row.event_datetime,
      expectedGuests: row.expected_guests,
      location: row.location,
      description: row.description,
      privateUseConfirmed: row.private_use_confirmed === true,
      privateUseConfirmedAt: row.private_use_confirmed_at,
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      partyCode: canShowJoin && code ? String(code) : null,
      joinPath: canShowJoin ? joinPath : null,
      joinUrl: canShowJoin && joinUrl ? joinUrl : null,
      canShowJoinLink: canShowJoin,
      canShowQr: canShowJoin,
      sessionStatus: session ? String(/** @type {any} */ (session).status) : null,
      endedAt: session && /** @type {any} */ (session).ended_at
        ? new Date(/** @type {any} */ (session).ended_at).toISOString()
        : null
    }
  }
}

/**
 * @param {{ getPool: () => import('pg').Pool | null }} d
 */
export function createHostPartyRequestsRouter(d) {
  const r = Router()
  const mapRequestRow = makeMapRequest(d)

  r.get('/', async (req, res, next) => {
    try {
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const u = /** @type {{ id: string }} */ (req.funsongUser)
      const rows = await listRequestsByHostId(u.id, pool)
      const out = []
      for (const row of rows) {
        out.push(await mapRequestRow(req, row))
      }
      return res.json({ partyRequests: out })
    } catch (e) {
      return next(e)
    }
  })

  const postH = makePostCreateHandler(d, mapRequestRow)
  r.post('/', postH)

  r.get('/:partyId', async (req, res, next) => {
    try {
      if (!UUID.test(String(req.params.partyId || ''))) {
        return res.status(400).json({ error: 'invalid_party_id' })
      }
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const u = /** @type {{ id: string }} */ (req.funsongUser)
      const row = await findRequestByIdForHost(req.params.partyId, u.id, pool)
      if (!row) {
        return res.status(404).json({ error: 'not_found' })
      }
      const body = await mapRequestRow(req, row)
      return res.json({ partyRequest: body })
    } catch (e) {
      return next(e)
    }
  })

  return { router: r, postPartyRequest: postH }
}

/**
 * @param {{ getPool: () => import('pg').Pool | null }} d
 * @param {ReturnType<typeof makeMapRequest>} mapRequestRow
 */
function makePostCreateHandler(d, mapRequestRow) {
  return function postHandler(req, res, next) {
    return postCreateInternal(req, res, next, d, mapRequestRow)
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @param {{ getPool: () => import('pg').Pool | null }} d
 * @param {ReturnType<typeof makeMapRequest>} mapRequestRow
 */
async function postCreateInternal(req, res, next, d, mapRequestRow) {
  try {
    const pool = d.getPool()
    if (!pool) {
      return res.status(503).json({ error: 'no_database' })
    }
    const u = /** @type {{ id: string }} */ (req.funsongUser)
    const b = /** @type {Record<string, unknown>} */ (req.body) || {}
    const partyName = String(b.partyName ?? b.party_name ?? '').trim()
    const eventRaw = b.eventDatetime ?? b.event_datetime
    const location = String(b.location ?? '').trim()
    if (!partyName) {
      return res.status(400).json({ error: 'party_name_required' })
    }
    if (eventRaw == null || eventRaw === '') {
      return res.status(400).json({ error: 'event_datetime_required' })
    }
    const eventDatetime = new Date(
      typeof eventRaw === 'string' || typeof eventRaw === 'number' ? eventRaw : String(eventRaw)
    )
    if (Number.isNaN(eventDatetime.getTime())) {
      return res.status(400).json({ error: 'event_datetime_invalid' })
    }
    if (!location) {
      return res.status(400).json({ error: 'location_required' })
    }
    const puc = b.privateUseConfirmed ?? b.private_use_confirmed
    if (puc !== true && puc !== 'true' && puc !== 1) {
      return res.status(400).json({ error: 'private_use_confirmation_required' })
    }
    const confirmedAt = new Date()
    const created = await createRequest(
      {
        hostId: u.id,
        partyName,
        eventDatetime,
        expectedGuests: 30,
        location,
        description: null,
        privateUseConfirmed: true,
        privateUseConfirmedAt: confirmedAt
      },
      pool
    )
    const approved = await approvePartyRequest(pool, String(created.id), u.id)
    if (!approved.ok) {
      return res.status(409).json({ error: approved.error })
    }
    const row = await findRequestById(String(created.id), pool)
    const body = await mapRequestRow(req, row || created)
    return res.status(201).json({ partyRequest: body })
  } catch (e) {
    return next(e)
  }
}

export { makePostCreateHandler, makeMapRequest }
