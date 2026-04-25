import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('migrations/014_party_request_private_use.sql', () => {
  it('adds private_use columns to party_requests', async () => {
    const p = fileURLToPath(new URL('../migrations/014_party_request_private_use.sql', import.meta.url))
    const sql = await readFile(p, 'utf8')
    expect(sql).toMatch(/private_use_confirmed/i)
    expect(sql).toMatch(/private_use_confirmed_at/i)
  })
})
