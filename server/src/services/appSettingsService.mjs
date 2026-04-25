import { getAllSettings, getSetting, upsertSetting } from '../db/repos/appSettingsRepo.mjs'

const INT_RULES = {
  max_party_guests: { min: 1, max: 100 },
  max_playlist_songs: { min: 1, max: 100 },
  party_auto_close_minutes: { min: 5, max: 1440 }
}

/**
 * @param {string} key
 * @param {number} defaultValue
 * @param {import('pg').Pool | import('pg').PoolClient} p
 */
export async function getIntSetting(key, defaultValue, p) {
  const row = await getSetting(String(key), p)
  if (!row) {
    return Number(defaultValue)
  }
  const n = Number.parseInt(String(row.value || ''), 10)
  if (!Number.isFinite(n)) {
    return Number(defaultValue)
  }
  return n
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} p
 */
export async function getPartyLimits(p) {
  const [maxGuests, maxPlaylistSongs, autoCloseMinutes] = await Promise.all([
    getIntSetting('max_party_guests', 30, p),
    getIntSetting('max_playlist_songs', 10, p),
    getIntSetting('party_auto_close_minutes', 300, p)
  ])
  return { maxGuests, maxPlaylistSongs, autoCloseMinutes }
}

/**
 * @param {string} key
 * @param {string | number | boolean} value
 * @param {string | null} updatedBy
 * @param {import('pg').Pool | import('pg').PoolClient} p
 */
export async function updateSetting(key, value, updatedBy, p) {
  const k = String(key)
  const raw = String(value)
  const rule = /** @type {{ min: number; max: number } | undefined} */ (INT_RULES[k])
  let valueType = 'string'

  if (rule) {
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n) || n < rule.min || n > rule.max) {
      const e = new Error(`invalid_integer_setting:${k}`)
      // @ts-ignore internal code for route handlers/tests
      e.code = 'invalid_integer_setting'
      throw e
    }
    valueType = 'integer'
  } else if (typeof value === 'boolean') {
    valueType = 'boolean'
  }

  return upsertSetting(
    {
      key: k,
      value: raw,
      valueType,
      updatedBy
    },
    p
  )
}

export async function getSettingsMap(p) {
  const rows = await getAllSettings(p)
  /** @type {Record<string, { value: string; valueType: string; description: string | null; updatedAt: string }>} */
  const out = {}
  for (const r of rows) {
    out[String(r.key)] = {
      value: String(r.value),
      valueType: String(r.value_type || 'string'),
      description: r.description == null ? null : String(r.description),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : ''
    }
  }
  return out
}
