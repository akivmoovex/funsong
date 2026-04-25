import path from 'node:path'

/**
 * Fail fast in production with clear errors when required env is missing.
 * See .env.example, README, and docs/AUDIO_STORAGE_RUNBOOK.md.
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
  const audio = String(process.env.AUDIO_STORAGE_DIR || '').trim()
  if (!audio) {
    missing.push('AUDIO_STORAGE_DIR')
  } else if (!path.isAbsolute(audio)) {
    const msg =
      'FATAL: AUDIO_STORAGE_DIR must be an absolute path in production (e.g. /home/youruser/funsong-audio), not a relative path. See docs/AUDIO_STORAGE_RUNBOOK.md'
    console.error(msg)
    process.exit(1)
  }
  if (missing.length === 0) return
  const one = missing.join(' and ')
  const msg = `FATAL: ${one} must be set in production (non-empty). Copy .env.example to .env, set values in the host panel, or see README and docs/AUDIO_STORAGE_RUNBOOK.md.`
  console.error(msg)
  process.exit(1)
}
