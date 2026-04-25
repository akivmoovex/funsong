const DEFAULT_POOL_CONFIG = Object.freeze({
  max: 10,
  connectionTimeoutMillis: 10_000
})

function hasNonEmptyString(value) {
  return Boolean(String(value || '').trim())
}

function isFalseString(value) {
  return String(value || '').trim().toLowerCase() === 'false'
}

export function getDbConfigSummaryFromEnv(env = process.env) {
  const hasDatabaseUrl = hasNonEmptyString(env.DATABASE_URL)
  const pgsslRejectUnauthorizedEnvSet = hasNonEmptyString(env.PGSSL_REJECT_UNAUTHORIZED)

  if (isFalseString(env.PGSSL_REJECT_UNAUTHORIZED)) {
    return {
      hasDatabaseUrl,
      sslRejectUnauthorized: false,
      pgsslRejectUnauthorizedEnvSet
    }
  }

  const sslMode = String(env.PGSSL_MODE || '').trim().toLowerCase()
  if (sslMode === 'supabase') {
    return {
      hasDatabaseUrl,
      sslRejectUnauthorized: true,
      pgsslRejectUnauthorizedEnvSet
    }
  }

  return {
    hasDatabaseUrl,
    sslRejectUnauthorized: 'default',
    pgsslRejectUnauthorizedEnvSet
  }
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

  const summary = getDbConfigSummaryFromEnv(env)
  if (summary.sslRejectUnauthorized === false) {
    poolConfig.ssl = { rejectUnauthorized: false }
    return poolConfig
  }

  // Keep default pg behavior unless explicitly asked for Supabase mode.
  if (summary.sslRejectUnauthorized === true) {
    poolConfig.ssl = { rejectUnauthorized: true }
  }

  return poolConfig
}
