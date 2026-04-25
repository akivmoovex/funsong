import { describe, expect, it, vi } from 'vitest'

vi.mock('./src/db/repos/usersRepo.mjs', () => ({
  findUserByEmail: vi.fn()
}))

import { findUserByEmail } from './src/db/repos/usersRepo.mjs'
import { resetSuperAdminPassword } from './scripts/resetSuperAdminPassword.mjs'

describe('resetSuperAdminPassword', () => {
  it('returns not_found when user does not exist', async () => {
    findUserByEmail.mockResolvedValueOnce(null)
    const pool = { query: vi.fn() }
    const out = await resetSuperAdminPassword({
      pool,
      email: 'admin@example.com',
      password: 'new-pass'
    })
    expect(out).toEqual({ ok: false, reason: 'not_found' })
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('refuses when user exists but is not super_admin', async () => {
    findUserByEmail.mockResolvedValueOnce({
      id: '6b6a4c52-8d5d-4f12-b7d7-68c8d3a5f318',
      role: 'host'
    })
    const pool = { query: vi.fn() }
    const out = await resetSuperAdminPassword({
      pool,
      email: 'host@example.com',
      password: 'new-pass'
    })
    expect(out).toEqual({ ok: false, reason: 'not_super_admin' })
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('updates password and active flag (with updated_at when column exists)', async () => {
    findUserByEmail.mockResolvedValueOnce({
      id: '6b6a4c52-8d5d-4f12-b7d7-68c8d3a5f318',
      role: 'super_admin'
    })
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ exists: true }] })
        .mockResolvedValueOnce({ rows: [] })
    }
    const out = await resetSuperAdminPassword({
      pool,
      email: 'admin@example.com',
      password: 'new-pass'
    })
    expect(out).toEqual({ ok: true })
    expect(pool.query).toHaveBeenCalledTimes(2)
    const updateSql = String(pool.query.mock.calls[1][0])
    expect(updateSql).toContain('updated_at = now()')
    expect(updateSql).toContain('is_active = true')
  })
})
