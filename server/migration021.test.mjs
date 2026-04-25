import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('migrations/021_party_playlist_requested_by_guest.sql', () => {
  it('adds requested_by_guest_id on playlist items', async () => {
    const p = fileURLToPath(new URL('../migrations/021_party_playlist_requested_by_guest.sql', import.meta.url))
    const sql = await readFile(p, 'utf8')
    expect(sql).toMatch(/ALTER TABLE party_playlist_items/i)
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS requested_by_guest_id uuid/i)
    expect(sql).toMatch(/REFERENCES party_guests \(id\) ON DELETE SET NULL/i)
  })
})
