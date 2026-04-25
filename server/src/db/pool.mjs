import { Pool } from 'pg'

let _pool = null

export function getPool() {
  if (!process.env.DATABASE_URL) return null
  if (_pool) return _pool
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 10_000
  })
  return _pool
}

export function resetPoolForTests() {
  if (!_pool) return Promise.resolve()
  const p = _pool
  _pool = null
  return p.end()
}
