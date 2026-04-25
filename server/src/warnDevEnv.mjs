/**
 * Non-fatal hints for local development. Never log connection strings or secrets.
 */
export function warnDevelopmentEnv() {
  if (process.env.NODE_ENV === 'production') return
  if (String(process.env.DATABASE_URL || '').trim()) {
    return
  }
  console.warn(
    '[funsong] DATABASE_URL is not set. Database-backed routes will be unavailable. Copy .env.example to .env or .env.local. See README → Environment Variables.'
  )
}
