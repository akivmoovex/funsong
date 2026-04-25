import { getDbPool } from './poolContext.mjs'

export async function findRequestById(id, p) {
  const q = getDbPool(p)
  const { rows } = await q.query('SELECT * FROM party_requests WHERE id = $1::uuid', [id])
  return rows[0] || null
}

/**
 * @param {string} id
 * @param {string} hostId
 * @param {import('pg').Pool} p
 */
export async function findRequestByIdForHost(id, hostId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    'SELECT * FROM party_requests WHERE id = $1::uuid AND host_id = $2::uuid',
    [id, hostId]
  )
  return rows[0] || null
}

export async function listRequestsByHostId(hostId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    'SELECT * FROM party_requests WHERE host_id = $1::uuid ORDER BY created_at DESC',
    [hostId]
  )
  return rows
}

/**
 * Pending party requests for super-admin queue (with host).
 * @param {import('pg').Pool} p
 */
export async function listPendingRequestsForAdmin(p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `SELECT
       pr.*,
       u.email AS host_email,
       u.display_name AS host_display_name
     FROM party_requests pr
     JOIN users u ON u.id = pr.host_id
     WHERE pr.status = 'pending'
     ORDER BY pr.created_at ASC`
  )
  return rows
}

/**
 * @param {{
 *  hostId: string
 *  partyName: string
 *  eventDatetime: string | Date
 *  expectedGuests: number
 *  location?: string | null
 *  description?: string | null
 *  privateUseConfirmed: boolean
 *  privateUseConfirmedAt: string | Date | null
 * }} o
 * @param {import('pg').Pool} p
 */
export async function createRequest(o, p) {
  const q = getDbPool(p)
  const at =
    o.privateUseConfirmed && o.privateUseConfirmedAt
      ? o.privateUseConfirmedAt instanceof Date
        ? o.privateUseConfirmedAt.toISOString()
        : o.privateUseConfirmedAt
      : null
  const { rows } = await q.query(
    `INSERT INTO party_requests (
        host_id, party_name, event_datetime, expected_guests, location, description, status,
        private_use_confirmed, private_use_confirmed_at
     ) VALUES (
        $1::uuid, $2, $3::timestamptz, $4, $5, $6, 'pending',
        $7::boolean, $8::timestamptz
     )
     RETURNING *`,
    [
      o.hostId,
      o.partyName,
      o.eventDatetime instanceof Date ? o.eventDatetime.toISOString() : o.eventDatetime,
      o.expectedGuests,
      o.location?.trim() || null,
      o.description ?? null,
      o.privateUseConfirmed,
      at
    ]
  )
  return rows[0]
}
