import { Router } from 'express'
import {
  getIntSetting,
  getPartyLimits,
  updateSetting
} from '../services/appSettingsService.mjs'

/**
 * @param {{ getPool: () => import('pg').Pool | null }} d
 */
export function createAdminSettingsRouter(d) {
  const r = Router()

  r.get('/', async (req, res, next) => {
    try {
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const limits = await getPartyLimits(pool)
      return res.json({
        settings: {
          maxPartyGuests: limits.maxGuests,
          maxPlaylistSongs: limits.maxPlaylistSongs,
          partyAutoCloseMinutes: limits.autoCloseMinutes
        }
      })
    } catch (e) {
      return next(e)
    }
  })

  r.post('/', async (req, res, next) => {
    try {
      const pool = d.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const b = /** @type {Record<string, unknown>} */ (req.body) || {}
      const maxPartyGuests = Number.parseInt(String(b.maxPartyGuests ?? ''), 10)
      const maxPlaylistSongs = Number.parseInt(String(b.maxPlaylistSongs ?? ''), 10)
      const partyAutoCloseMinutes = Number.parseInt(String(b.partyAutoCloseMinutes ?? ''), 10)
      if (
        !Number.isFinite(maxPartyGuests) ||
        !Number.isFinite(maxPlaylistSongs) ||
        !Number.isFinite(partyAutoCloseMinutes)
      ) {
        return res.status(400).json({ error: 'invalid_integer' })
      }
      const u = /** @type {{ id: string }} */ (req.funsongUser)
      try {
        await updateSetting('max_party_guests', maxPartyGuests, u.id, pool)
        await updateSetting('max_playlist_songs', maxPlaylistSongs, u.id, pool)
        await updateSetting('party_auto_close_minutes', partyAutoCloseMinutes, u.id, pool)
      } catch (e) {
        if (/** @type {any} */ (e)?.code === 'invalid_integer_setting') {
          const [_, key] = String(/** @type {Error} */ (e).message || '').split(':')
          return res.status(400).json({ error: 'invalid_range', key: key || null })
        }
        throw e
      }
      const out = {
        maxPartyGuests: await getIntSetting('max_party_guests', 30, pool),
        maxPlaylistSongs: await getIntSetting('max_playlist_songs', 10, pool),
        partyAutoCloseMinutes: await getIntSetting('party_auto_close_minutes', 300, pool)
      }
      return res.json({ ok: true, settings: out })
    } catch (e) {
      return next(e)
    }
  })

  return r
}
