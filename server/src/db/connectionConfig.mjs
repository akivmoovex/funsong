const DEFAULT_POOL_CONFIG = Object.freeze({
  max: 10,
  connectionTimeoutMillis: 10_000
})

function isFalseString(value) {
  return String(value || '').trim().toLowerCase() === 'false'
}

/**
 * Build a safe pg Pool config from env vars.
 * Throws when DATABASE_URL is missing/blank.
 *
 * Supported toggles:
 * - PGSSL_REJECT_UNAUTHORIZED=false: opt into ssl.rejectUnauthorized=false
 * - PGSSL_MODE=supabase: force explicit SSL on pooled Supabase-style URLs
 */
export function buildPoolConfigFromEnv(env = process.env) {
  const connectionString = String(env.DATABASE_URL || '').trim()
  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }

  const poolConfig = {
    connectionString,
    ...DEFAULT_POOL_CONFIG
  }

  if (isFalseString(env.PGSSL_REJECT_UNAUTHORIZED)) {
    poolConfig.ssl = { rejectUnauthorized: false }
    return poolConfig
  }

  const sslMode = String(env.PGSSL_MODE || '').trim().toLowerCase()
  const isSupabaseMode = sslMode === 'supabase'

  // Keep default pg behavior unless explicitly asked for Supabase mode.
  if (isSupabaseMode) {
    poolConfig.ssl = { rejectUnauthorized: true }
  }

  return poolConfig
}
