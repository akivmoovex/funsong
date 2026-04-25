import { describe, expect, it } from 'vitest'
import { buildPoolConfigFromEnv } from './connectionConfig.mjs'

describe('buildPoolConfigFromEnv', () => {
  const baseEnv = {
    DATABASE_URL: 'postgresql://user:password@example.com:6543/postgres?sslmode=require'
  }

  it('does not disable certificate verification by default', () => {
    const cfg = buildPoolConfigFromEnv(baseEnv)
    expect(cfg.connectionString).toBe(baseEnv.DATABASE_URL)
    expect(cfg.max).toBe(10)
    expect(cfg.connectionTimeoutMillis).toBe(10_000)
    expect(cfg.ssl?.rejectUnauthorized).not.toBe(false)
  })

  it('sets ssl.rejectUnauthorized=false when PGSSL_REJECT_UNAUTHORIZED=false', () => {
    const cfg = buildPoolConfigFromEnv({
      ...baseEnv,
      PGSSL_REJECT_UNAUTHORIZED: 'false'
    })
    expect(cfg.ssl).toEqual({ rejectUnauthorized: false })
  })

  it('requires DATABASE_URL', () => {
    expect(() => buildPoolConfigFromEnv({})).toThrow('DATABASE_URL is required')
    expect(() => buildPoolConfigFromEnv({ DATABASE_URL: '   ' })).toThrow(
      'DATABASE_URL is required'
    )
  })
})
