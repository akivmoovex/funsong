import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  getMissingRequiredMigrations,
  getAppliedMigrationsSet,
  listMigrationFileNames,
  runMigrationsFromDir
} from './src/db/runMigrations.mjs'

describe('listMigrationFileNames', () => {
  it('filters and sorts .sql with numeric-aware order', () => {
    const list = listMigrationFileNames(['10_x.sql', '1_a.sql', 'a.txt', '2_b.sql'])
    expect(list).toEqual(['1_a.sql', '2_b.sql', '10_x.sql'])
  })
})

describe('getAppliedMigrationsSet', () => {
  it('returns empty set when the tracking table is missing (42P01)', async () => {
    const pool = {
      query: vi.fn().mockRejectedValue({ code: '42P01' })
    }
    const s = await getAppliedMigrationsSet(pool)
    expect(s.size).toBe(0)
  })

  it('returns applied file names from schema_migrations', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ name: '001_a.sql' }, { name: '002_b.sql' }] })
    }
    const s = await getAppliedMigrationsSet(pool)
    expect([...s].sort()).toEqual(['001_a.sql', '002_b.sql'])
  })
})

describe('getMissingRequiredMigrations', () => {
  it('returns missing required migration names', () => {
    const applied = new Set(['001_create_schema_migrations.sql', '020_password_reset_requests.sql'])
    const missing = getMissingRequiredMigrations(applied, [
      '020_password_reset_requests.sql',
      '021_party_playlist_requested_by_guest.sql'
    ])
    expect(missing).toEqual(['021_party_playlist_requested_by_guest.sql'])
  })

  it('returns empty array when all required migrations are applied', () => {
    const applied = new Set(['021_party_playlist_requested_by_guest.sql'])
    const missing = getMissingRequiredMigrations(applied, ['021_party_playlist_requested_by_guest.sql'])
    expect(missing).toEqual([])
  })
})

describe('runMigrationsFromDir (injected fs)', () => {
  it('applies only pending files and records the name in a transaction', async () => {
    const log = { query: [] }
    const pool = {
      query: vi.fn(async (q) => {
        if (q.startsWith('SELECT name FROM schema_migrations')) {
          return { rows: [] }
        }
        throw new Error('unexpected top-level ' + q)
      }),
      connect: vi.fn(async () => {
        return {
          async query(q) {
            const line = (String(q).split('\n')[0] || '').trim()
            log.query.push(line)
            return {}
          },
          release: vi.fn()
        }
      })
    }
    const fs = {
      readdir: async () => ['001_one.sql', '002_two.sql'],
      readFile: async (f) => {
        if (String(f).endsWith('001_one.sql')) {
          return 'SELECT 1'
        }
        if (String(f).endsWith('002_two.sql')) {
          return 'SELECT 2'
        }
        throw new Error('bad ' + f)
      }
    }
    await runMigrationsFromDir(pool, '/tmp/migrations', fs)
    const calls = log.query.join(';;')
    expect(calls).toMatch(/BEGIN/)
    expect(calls).toMatch(/INSERT INTO schema_migrations/)
    expect(calls).toMatch(/SELECT 1/)
    expect(calls).toMatch(/SELECT 2/)
  })
})

describe('001_create_schema_migrations.sql', () => {
  it('defines schema_migrations with IF NOT EXISTS', async () => {
    const file = fileURLToPath(
      new URL('../migrations/001_create_schema_migrations.sql', import.meta.url)
    )
    const body = await readFile(file, 'utf8')
    expect(body).toMatch(/schema_migrations/i)
    expect(body).toMatch(/CREATE TABLE IF NOT EXISTS/i)
  })
})
