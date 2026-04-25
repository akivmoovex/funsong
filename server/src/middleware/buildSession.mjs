import connectPg from 'connect-pg-simple'
import session from 'express-session'
import { getPool } from '../db/pool.mjs'

const SIX_HOURS = 6 * 60 * 60 * 1000
const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000

const PgStore = connectPg(session)

/**
 * @param {{
 *   getPool?: () => import('pg').Pool | null
 *   sessionStore?: import('express-session').Store
 *   sessionSecret?: string
 *   sessionMaxAgeMs?: number
 *   secureCookie?: boolean
 * }} o
 * @returns {import('express').RequestHandler}
 */
export function buildSession(o = {}) {
  const sec =
    o.sessionSecret ?? process.env.SESSION_SECRET ?? (process.env.NODE_ENV === 'production' ? null : 'dev-SESSION')
  if (!sec) {
    throw new Error('SESSION_SECRET is required in production')
  }

  let store = o.sessionStore
  if (!store) {
    const p = o.getPool ? o.getPool() : getPool()
    if (p) {
      store = new PgStore({ pool: p, tableName: 'session', createTableIfMissing: false })
    }
  }

  return session({
    name: 'funsong.sid',
    store: store,
    secret: sec,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: Boolean(
        o.secureCookie ?? (process.env.NODE_ENV === 'production' && process.env.FORCE_INSECURE_COOKIE !== '1')
      ),
      maxAge: o.sessionMaxAgeMs ?? (process.env.NODE_ENV === 'production' ? SIXTY_DAYS : SIX_HOURS)
    }
  })
}
