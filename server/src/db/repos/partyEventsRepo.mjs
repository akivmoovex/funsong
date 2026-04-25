import { getDbPool } from './poolContext.mjs'

export async function listBySessionId(sessionId, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    'SELECT * FROM party_events WHERE session_id = $1::uuid ORDER BY created_at, id',
    [sessionId]
  )
  return rows
}

export async function appendEvent(o, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `INSERT INTO party_events (session_id, event_type, payload, created_by_party_guest_id)
     VALUES ($1::uuid, btrim($2::text), $3::jsonb, $4::uuid)
     RETURNING *`,
    [o.sessionId, o.eventType, o.payload ?? null, o.createdByPartyGuestId ?? null]
  )
  return rows[0]
}
