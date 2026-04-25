import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getIntSetting, getPartyLimits, updateSetting } from './src/services/appSettingsService.mjs'
import * as repo from './src/db/repos/appSettingsRepo.mjs'

vi.mock('./src/db/repos/appSettingsRepo.mjs', () => ({
  getSetting: vi.fn(),
  getAllSettings: vi.fn(),
  upsertSetting: vi.fn()
}))

const { getSetting, upsertSetting } = repo

beforeEach(() => {
  vi.clearAllMocks()
})

describe('appSettingsService', () => {
  it('getIntSetting returns stored integer value', async () => {
    getSetting.mockResolvedValue({ key: 'max_party_guests', value: '42' })
    const v = await getIntSetting('max_party_guests', 30, /** @type {any} */ ({}))
    expect(v).toBe(42)
  })

  it('getIntSetting falls back to default when setting is missing', async () => {
    getSetting.mockResolvedValue(null)
    const v = await getIntSetting('max_party_guests', 30, /** @type {any} */ ({}))
    expect(v).toBe(30)
  })

  it('getPartyLimits reads all configured defaults', async () => {
    getSetting
      .mockResolvedValueOnce({ key: 'max_party_guests', value: '31' })
      .mockResolvedValueOnce({ key: 'max_playlist_songs', value: '11' })
      .mockResolvedValueOnce({ key: 'party_auto_close_minutes', value: '301' })
    const out = await getPartyLimits(/** @type {any} */ ({}))
    expect(out).toEqual({
      maxGuests: 31,
      maxPlaylistSongs: 11,
      autoCloseMinutes: 301
    })
  })

  it('updateSetting rejects invalid integer range', async () => {
    await expect(
      updateSetting('max_playlist_songs', 0, null, /** @type {any} */ ({}))
    ).rejects.toMatchObject({ code: 'invalid_integer_setting' })
    expect(upsertSetting).not.toHaveBeenCalled()
  })

  it('updateSetting upserts valid integer settings', async () => {
    upsertSetting.mockResolvedValue({
      key: 'party_auto_close_minutes',
      value: '300',
      value_type: 'integer'
    })
    const out = await updateSetting(
      'party_auto_close_minutes',
      300,
      '1a2b3c4d-1a2b-1a2b-1a2b-123456789abc',
      /** @type {any} */ ({})
    )
    expect(upsertSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'party_auto_close_minutes',
        value: '300',
        valueType: 'integer'
      }),
      expect.anything()
    )
    expect(out?.value).toBe('300')
  })
})
