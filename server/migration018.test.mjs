import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('migrations/018_app_settings.sql', () => {
  it('creates app_settings and seeds default keys', async () => {
    const p = fileURLToPath(new URL('../migrations/018_app_settings.sql', import.meta.url))
    const sql = await readFile(p, 'utf8')
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS app_settings/i)
    expect(sql).toMatch(/key text PRIMARY KEY/i)
    expect(sql).toMatch(/updated_by uuid REFERENCES users/i)
    expect(sql).toMatch(/max_party_guests/i)
    expect(sql).toMatch(/max_playlist_songs/i)
    expect(sql).toMatch(/party_auto_close_minutes/i)
    expect(sql).toMatch(/ON CONFLICT \(key\) DO NOTHING/i)
  })
})
