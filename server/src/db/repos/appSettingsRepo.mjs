import { getDbPool } from './poolContext.mjs'

/**
 * @param {string} key
 * @param {import('pg').Pool | import('pg').PoolClient} p
 */
export async function getSetting(key, p) {
  const q = getDbPool(p)
  const { rows } = await q.query('SELECT * FROM app_settings WHERE key = $1::text', [key])
  return rows[0] || null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} p
 */
export async function getAllSettings(p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    'SELECT * FROM app_settings ORDER BY key ASC'
  )
  return rows
}

/**
 * @param {{
 *   key: string
 *   value: string
 *   valueType?: string
 *   description?: string | null
 *   updatedBy?: string | null
 * }} o
 * @param {import('pg').Pool | import('pg').PoolClient} p
 */
export async function upsertSetting(o, p) {
  const q = getDbPool(p)
  const { rows } = await q.query(
    `INSERT INTO app_settings (key, value, value_type, description, updated_by, updated_at)
     VALUES ($1::text, $2::text, $3::text, $4::text, $5::uuid, now())
     ON CONFLICT (key)
     DO UPDATE SET
       value = EXCLUDED.value,
       value_type = EXCLUDED.value_type,
       description = EXCLUDED.description,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()
     RETURNING *`,
    [
      String(o.key),
      String(o.value),
      String(o.valueType || 'string'),
      o.description == null ? null : String(o.description),
      o.updatedBy ?? null
    ]
  )
  return rows[0] || null
}
