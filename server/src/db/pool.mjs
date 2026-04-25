import { Pool } from 'pg'
import { buildPoolConfigFromEnv } from './connectionConfig.mjs'

let _pool = null

export function getPool() {
  if (!String(process.env.DATABASE_URL || '').trim()) return null
  if (_pool) return _pool
  _pool = new Pool(buildPoolConfigFromEnv(process.env))
  return _pool
}

export function resetPoolForTests() {
  if (!_pool) return Promise.resolve()
  const p = _pool
  _pool = null
  return p.end()
}
