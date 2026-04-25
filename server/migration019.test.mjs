import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('migrations/019_user_profile_and_favorites.sql', () => {
  it('adds profile fields and favorites table', async () => {
    const p = fileURLToPath(
      new URL('../migrations/019_user_profile_and_favorites.sql', import.meta.url)
    )
    const sql = await readFile(p, 'utf8')
    expect(sql).toMatch(/ALTER TABLE users/i)
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS first_name text/i)
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS last_name text/i)
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS phone_number text/i)
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS avatar_key text/i)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS user_favorite_songs/i)
    expect(sql).toMatch(/PRIMARY KEY \(user_id, song_id\)/i)
    expect(sql).toMatch(/REFERENCES users\(id\) ON DELETE CASCADE/i)
    expect(sql).toMatch(/REFERENCES songs\(id\) ON DELETE CASCADE/i)
  })
})
