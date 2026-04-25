import { getPool } from '../pool.mjs'

export function getDbPool(p) {
  const out = p ?? getPool()
  if (!out) {
    throw new Error('Database is not configured: set DATABASE_URL')
  }
  return out
}
