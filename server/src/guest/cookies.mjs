import { randomBytes } from 'node:crypto'

const COOKIE = 'fs_guest'
const MAX_AGE = 30 * 24 * 60 * 60

function secureInProd() {
  return process.env.NODE_ENV === 'production' && process.env.FORCE_INSECURE_COOKIE !== '1'
}

/**
 * Opaque party guest id (no DB UUID in cookie value — token only).
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function readGuestTokenFromRequest(req) {
  const raw = req.headers.cookie
  if (!raw || typeof raw !== 'string') {
    return null
  }
  for (const part of raw.split(';')) {
    const s = part.trim()
    if (!s.toLowerCase().startsWith(`${COOKIE}=`)) continue
    const v = s.slice(COOKIE.length + 1).trim()
    if (!v) return null
    return decodeURIComponent(v)
  }
  return null
}

/**
 * @returns {string} hex, 32 bytes
 */
export function newGuestToken() {
  return randomBytes(32).toString('hex')
}

/**
 * @param {import('express').Response} res
 * @param {string} token
 */
export function setGuestTokenCookie(res, token) {
  const secure = secureInProd() ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`
  )
}

/**
 * @param {import('express').Response} res
 */
export function clearGuestTokenCookie(res) {
  const secure = secureInProd() ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  )
}
