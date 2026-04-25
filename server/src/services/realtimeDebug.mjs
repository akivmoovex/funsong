function isRealtimeDebugEnabled() {
  return String(process.env.REALTIME_DEBUG || '').toLowerCase() === 'true'
}

/**
 * @param {string} value
 */
function shortId(value) {
  const s = String(value || '')
  if (!s) return ''
  return s.length > 8 ? s.slice(0, 8) : s
}

/**
 * @param {string} event
 * @param {{
 *   sessionId?: string | null
 *   partyCode?: string | null
 *   source?: string | null
 *   count?: number | null
 *   requestId?: string | null
 * }} [meta]
 */
export function logRealtimeEvent(event, meta = {}) {
  if (!isRealtimeDebugEnabled()) return
  const payload = {
    event,
    sessionId: meta.sessionId ? shortId(meta.sessionId) : undefined,
    partyCode: meta.partyCode ? String(meta.partyCode) : undefined,
    source: meta.source ? String(meta.source) : undefined,
    count: typeof meta.count === 'number' ? meta.count : undefined,
    requestId: meta.requestId ? shortId(meta.requestId) : undefined
  }
  const compact = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
  )
  console.info('[realtime:debug]', compact)
}

