export function makeDbHealthHandler(getP) {
  return async (_req, res) => {
    const p = getP()
    if (!p) {
      return res.json({
        database: {
          configured: false,
          ok: false,
          message: 'DATABASE_URL is not set'
        }
      })
    }
    try {
      await p.query('SELECT 1 as ok')
      return res.json({
        database: {
          configured: true,
          ok: true
        }
      })
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      return res.json({
        database: {
          configured: true,
          ok: false,
          message: err.message
        }
      })
    }
  }
}
