import { describe, expect, it, vi } from 'vitest'
import { createUser, findUserByEmail, findUserById } from './usersRepo.mjs'

const mockPool = (row) => ({
  query: vi.fn().mockResolvedValue({ rows: row ? [row] : [] })
})

describe('usersRepo', () => {
  it('findUserByEmail issues a lookup', async () => {
    const pool = mockPool(null)
    const r = await findUserByEmail('Hi@X.com', pool)
    expect(r).toBeNull()
    expect(pool.query).toHaveBeenCalledTimes(1)
  })

  it('findUserById returns a row', async () => {
    const u = { id: 'a1a1a1a1-a1a1-41a1-81a1-aaaaaaaaaaaa', email: 'h@e.l' }
    const pool = mockPool(u)
    const r = await findUserById('a1a1a1a1-a1a1-41a1-81a1-aaaaaaaaaaaa', pool)
    expect(r).toEqual(u)
  })

  it('createUser performs INSERT and returns the row', async () => {
    const created = {
      id: 'b2b2b2b2-b2b2-42b2-82b2-bbbbbbbbbbbb',
      email: 'a@a.com',
      display_name: 'A',
      role: 'host'
    }
    const pool = { query: vi.fn().mockResolvedValue({ rows: [created] }) }
    const r = await createUser(
      { email: 'A@A.com', displayName: 'A', role: 'host' },
      pool
    )
    expect(r).toEqual(created)
    const arg = pool.query.mock.calls[0]
    expect(String(arg[0]).toLowerCase()).toMatch(/insert into users/)
  })
})
