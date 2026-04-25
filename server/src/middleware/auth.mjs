import { findUserById } from '../db/repos/usersRepo.mjs'
import { getPool } from '../db/pool.mjs'
import { verifyPassword } from '../auth/password.mjs'

function isApiPath(req) {
  const u = String(/** @type {any} */ (req).originalUrl || /** @type {any} */ (req).url || req.path || '')
  const path = u.split('?')[0]
  return path.startsWith('/api') || (req.path || '').startsWith('/api')
}

function toPublicUser(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active !== false
  }
}

function clearSession(req) {
  return new Promise((resolve) => {
    if (!req.session) return resolve()
    req.session.destroy(() => resolve())
  })
}

function redirectLogin(req, res) {
  const next = (req.originalUrl || req.path || '/').split('?')[0]
  const q = new URLSearchParams()
  if (next && next !== '/login') q.set('next', next)
  res.redirect(302, `/login?${q.toString()}`)
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} [reason]
 */
export function sendUnauthorized(req, res, reason) {
  if (isApiPath(req)) {
    return res.status(401).json({ error: 'unauthorized', reason: reason || 'auth' })
  }
  return redirectLogin(req, res)
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function sendForbidden(req, res) {
  if (isApiPath(req)) {
    return res.status(403).json({ error: 'forbidden' })
  }
  return res.redirect(302, '/?error=forbidden')
}

/**
 * Load session user; respond 401/403/redirect if not allowed. Attaches req.funsongUser.
 * @param {{ getPool?: typeof getPool, findUserById?: typeof findUserById }} [deps]
 */
export function makeRequireAuth(deps = {}) {
  const f = deps.findUserById ?? findUserById
  const gPool = deps.getPool ?? getPool

  return async function requireAuth(req, res, next) {
    try {
      const pool = gPool()
      if (!pool) {
        if (isApiPath(req)) {
          return res.status(503).json({ error: 'no_database' })
        }
        return res.status(503).type('text').send('Service unavailable')
      }
      if (!req.session || !req.session.userId) {
        return sendUnauthorized(req, res)
      }
      const u = await f(req.session.userId, pool)
      if (!u) {
        await clearSession(req)
        return sendUnauthorized(req, res, 'stale')
      }
      if (u.is_active === false) {
        await clearSession(req)
        if (isApiPath(req)) {
          return res.status(403).json({ error: 'forbidden', reason: 'inactive' })
        }
        return res.redirect(302, '/login?reason=inactive')
      }
      req.funsongUser = u
      return next()
    } catch (e) {
      return next(e)
    }
  }
}

/**
 * @param {{ getPool?: typeof getPool, findUserById?: typeof findUserById }} [deps]
 * @returns {import('express').RequestHandler}
 */
export function makeGetMeHandler(deps = {}) {
  const gPool = deps.getPool || getPool
  const f = deps.findUserById || findUserById
  return async function getMeHandler(req, res) {
    try {
      if (!req.session || !req.session.userId) {
        return res.json({ user: null })
      }
      const pool = gPool()
      if (!pool) {
        return res.json({ user: null })
      }
      const u = await f(req.session.userId, pool)
      if (!u) {
        await clearSession(req)
        return res.json({ user: null, reason: 'stale' })
      }
      if (u.is_active === false) {
        await clearSession(req)
        return res.json({ user: null, reason: 'inactive' })
      }
      return res.json({ user: toPublicUser(u) })
    } catch (e) {
      console.error(e)
      return res.status(500).json({ error: 'server' })
    }
  }
}

export function makeRequireHost() {
  return function requireHost(req, res, next) {
    const u = /** @type {import('express').Request & { funsongUser?: { role: string } }} */ (req).funsongUser
    if (!u) return sendUnauthorized(req, res)
    if (u.role !== 'host' && u.role !== 'super_admin') {
      return sendForbidden(req, res)
    }
    return next()
  }
}

export function makeRequireSuperAdmin() {
  return function requireSuperAdmin(req, res, next) {
    const u = /** @type {import('express').Request & { funsongUser?: { role: string } }} */ (req).funsongUser
    if (!u) return sendUnauthorized(req, res)
    if (u.role !== 'super_admin') {
      return sendForbidden(req, res)
    }
    return next()
  }
}

export { toPublicUser }

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @param {{ getPool: typeof getPool, findUserByEmail: (e: string, p: any) => Promise<unknown> }} a
 */
export function makePostLoginHandler(a) {
  return async function postLoginHandler(req, res) {
    try {
      const pool = a.getPool()
      if (!pool) {
        return res.status(503).json({ error: 'no_database' })
      }
      const { email, password } = /** @type {{ email?: string; password?: string }} */ (req.body) || {}
      if (!email || !password) {
        return res.status(400).json({ error: 'email_password_required' })
      }
      const { findUserByEmail } = a
      const u = await findUserByEmail(String(email), pool)
      if (!u) {
        return res.status(401).json({ error: 'invalid_credentials' })
      }
      if (u.is_active === false) {
        return res.status(403).json({ error: 'inactive' })
      }
      if (!u.password_hash) {
        return res.status(401).json({ error: 'invalid_credentials' })
      }
      const ok = await verifyPassword(String(password), u.password_hash)
      if (!ok) {
        return res.status(401).json({ error: 'invalid_credentials' })
      }
      return new Promise((resolve) => {
        req.session.regenerate((err) => {
          if (err) {
            res.status(500).json({ error: 'session' })
            return resolve()
          }
          req.session.userId = u.id
          return req.session.save((saveErr) => {
            if (saveErr) {
              res.status(500).json({ error: 'session' })
              return resolve()
            }
            res.json({ user: toPublicUser(u) })
            return resolve()
          })
        })
      })
    } catch (e) {
      console.error(e)
      return res.status(500).json({ error: 'server' })
    }
  }
}

export function makePostLogoutHandler() {
  return function postLogoutHandler(req, res) {
    if (!req.session) {
      return res.json({ ok: true })
    }
    return req.session.destroy((err) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ error: 'logout' })
      }
      return res.json({ ok: true })
    })
  }
}
