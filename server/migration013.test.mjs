import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('migrations/013_party_controller_audio.sql', () => {
  it('adds controller_audio_enabled to party_sessions', async () => {
    const p = fileURLToPath(new URL('../migrations/013_party_controller_audio.sql', import.meta.url))
    const sql = await readFile(p, 'utf8')
    expect(sql).toMatch(/controller_audio_enabled/i)
  })
})
