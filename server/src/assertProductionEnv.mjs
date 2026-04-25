/**
 * Fail fast in production with clear errors when required env is missing.
 * See .env.example and README (Hostinger / production deployment).
 */
export function assertProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return
  const missing = []
  if (!String(process.env.DATABASE_URL || '').trim()) {
    missing.push('DATABASE_URL')
  }
  if (!String(process.env.SESSION_SECRET || '').trim()) {
    missing.push('SESSION_SECRET')
  }
  if (missing.length === 0) return
  const one = missing.join(' and ')
  const msg = `FATAL: ${one} must be set in production (non-empty). Copy .env.example to .env, set values in the host panel, or see README deployment.`
  console.error(msg)
  process.exit(1)
}
