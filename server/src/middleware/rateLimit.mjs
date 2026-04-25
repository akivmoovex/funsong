/**
 * In-memory fixed-window rate limiting (no extra packages).
 * Keys: client IP (use TRUST_PROXY in production behind a reverse proxy).
 * Env is read on each request so tests can override limits.
 */

const MSG = 'Too many attempts. Please try again shortly.'

/**
 * @returns {boolean}
 */
function shouldBypass() {
  if (process.env.RATE_LIMIT_BYPASS === '0' || process.env.RATE_LIMIT_BYPASS === 'false') {
    return false
  }
  if (process.env.RATE_LIMIT_BYPASS === '1') {
    return true
  }
  if (process.env.VITEST === 'true' || process.env.VITEST) {
    return true
  }
  return false
}

/**
 * @param {import('express').Request} req
 * @returns {string}
 */
function clientKey(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  return String(ip)
}

/**
 * @param {string} env
 * @param {number} defaultMinutes
 * @param {string} [msEnv]
 * @returns {number} window length in ms
 */
export function windowMsFromEnv(env, defaultMinutes, msEnv) {
  if (msEnv && process.env[msEnv] !== undefined && String(process.env[msEnv]).trim() !== '') {
    const n = Number(process.env[msEnv])
    if (Number.isFinite(n) && n > 0) {
      return Math.floor(n)
    }
  }
  const m = Number(process.env[env])
  const minutes = Number.isFinite(m) && m > 0 ? m : defaultMinutes
  return Math.floor(minutes * 60 * 1000)
}

/**
 * @param {string} env
 * @param {number} def
 * @returns {number}
 */
export function maxFromEnv(env, def) {
  const n = Number(process.env[env])
  if (Number.isFinite(n) && n >= 1) {
    return Math.floor(n)
  }
  return def
}

/**
 * @param {{
 *   name: string
 *   maxEnv: string
 *   minutesEnv: string
 *   windowMsEnv?: string
 *   defaultMinutes: number
 *   defaultMax: number
 * }} o
 * @returns {import('express').RequestHandler}
 */
function createWindowLimiter(o) {
  /** @type {Map<string, { resetAt: number; count: number }>} */
  const buckets = new Map()

  return function rateLimit(req, res, next) {
    if (shouldBypass()) {
      return next()
    }
    const windowMs = windowMsFromEnv(o.minutesEnv, o.defaultMinutes, o.windowMsEnv)
    const max = maxFromEnv(o.maxEnv, o.defaultMax)
    const k = clientKey(req) + ':' + o.name
    const now = Date.now()
    let b = buckets.get(k)
    if (!b || now >= b.resetAt) {
      b = { resetAt: now + windowMs, count: 0 }
    }
    b.count += 1
    buckets.set(k, b)
    if (b.count > max) {
      const sec = Math.max(1, Math.ceil((b.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(sec))
      return res.status(429).type('json').json({
        error: 'rate_limited',
        message: MSG
      })
    }
    return next()
  }
}

/**
 * Stricter: login (POST /api/auth/login, POST /login)
 * Defaults: 15 min, 20 attempts
 */
export const loginRateLimit = createWindowLimiter({
  name: 'login',
  maxEnv: 'RATE_LIMIT_LOGIN_MAX',
  minutesEnv: 'RATE_LIMIT_LOGIN_WINDOW_MINUTES',
  windowMsEnv: 'RATE_LIMIT_LOGIN_WINDOW_MS',
  defaultMinutes: 15,
  defaultMax: 20
})

/**
 * Moderate: guest join POST
 */
export const joinRateLimit = createWindowLimiter({
  name: 'join',
  maxEnv: 'RATE_LIMIT_JOIN_MAX',
  minutesEnv: 'RATE_LIMIT_JOIN_WINDOW_MINUTES',
  windowMsEnv: 'RATE_LIMIT_JOIN_WINDOW_MS',
  defaultMinutes: 1,
  defaultMax: 60
})

/**
 * Moderate: request-control, request-song (same pool as join numerically)
 */
export const partyGuestRequestRateLimit = createWindowLimiter({
  name: 'party_guest',
  maxEnv: 'RATE_LIMIT_JOIN_MAX',
  minutesEnv: 'RATE_LIMIT_JOIN_WINDOW_MINUTES',
  windowMsEnv: 'RATE_LIMIT_JOIN_WINDOW_MS',
  defaultMinutes: 1,
  defaultMax: 60
})

export { shouldBypass, clientKey, MSG as rateLimitMessage }
