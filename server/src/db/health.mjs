export function makeDbHealthHandler(getP, getDbConfigSummary = null) {
  const includeDiagnostics = process.env.NODE_ENV !== 'production'
  const diagnostics = includeDiagnostics && typeof getDbConfigSummary === 'function'
    ? { config: getDbConfigSummary() }
    : {}

  return async (_req, res) => {
    const p = getP()
    if (!p) {
      return res.json({
        database: {
          configured: false,
          ok: false,
          message: 'DATABASE_URL is not set',
          ...diagnostics
        }
      })
    }
    try {
      await p.query('SELECT 1 as ok')
      return res.json({
        database: {
          configured: true,
          ok: true,
          ...diagnostics
        }
      })
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      return res.json({
        database: {
          configured: true,
          ok: false,
          message: err.message,
          ...diagnostics
        }
      })
    }
  }
}
