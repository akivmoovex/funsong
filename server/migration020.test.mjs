import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('migrations/020_password_reset_requests.sql', () => {
  it('creates reset request table and indexes', async () => {
    const p = fileURLToPath(new URL('../migrations/020_password_reset_requests.sql', import.meta.url))
    const sql = await readFile(p, 'utf8')
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS password_reset_requests/i)
    expect(sql).toMatch(/email text NOT NULL/i)
    expect(sql).toMatch(/user_id uuid REFERENCES users\(id\)/i)
    expect(sql).toMatch(/status text NOT NULL DEFAULT 'pending'/i)
    expect(sql).toMatch(/requested_at timestamptz NOT NULL DEFAULT now\(\)/i)
  })
})
