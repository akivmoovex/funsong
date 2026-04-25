import { findRequestByIdForHost } from '../db/repos/partyRequestsRepo.mjs'
import { findSessionByPartyRequestId } from '../db/repos/partySessionsRepo.mjs'
import QRCode from 'qrcode'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {{ getPool: () => import('pg').Pool | null }} d
 */
export function makeHostPartyQrHandler(d) {
  return async function hostPartyQrHandler(req, res, next) {
    try {
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const u = /** @type {{ id: string } | undefined} */ (req.funsongUser)
      if (!u?.id) {
        return res.status(401).end()
      }
      const id = String(req.params.partyId || '')
      if (!UUID.test(id)) {
        return res.status(400).json({ error: 'invalid_party_id' })
      }
      const row = await findRequestByIdForHost(id, u.id, pool)
      if (!row) {
        return res.status(404).end()
      }
      if (row.status !== 'approved') {
        return res.status(404).end()
      }
      const session = await findSessionByPartyRequestId(row.id, pool)
      if (!session || session.status === 'disabled') {
        return res.status(404).end()
      }
      const code = session.party_code || session.join_code
      if (!code) {
        return res.status(404).end()
      }
      const pathOnly = `/join/${encodeURIComponent(String(code))}`
      const base = req.get('host') ? `${req.protocol}://${req.get('host')}` : ''
      const full = base ? `${base}${pathOnly}` : pathOnly
      const fmt = String(/** @type {Record<string, string>} */ (req.query).format || 'png')
        .toLowerCase()
        .trim()
      if (fmt === 'json') {
        return res.json({
          partyCode: String(code),
          joinPath: pathOnly,
          joinUrl: full
        })
      }
      const buf = await QRCode.toBuffer(full, { type: 'png', width: 256, margin: 1 })
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'private, max-age=60')
      return res.status(200).send(buf)
    } catch (e) {
      return next(e)
    }
  }
}
