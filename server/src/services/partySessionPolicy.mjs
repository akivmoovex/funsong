/**
 * @param {Record<string, unknown> | null | undefined} session
 * @returns {boolean} true if karaoke / playback control is allowed
 */
export function sessionAllowsLivePartyControl(session) {
  if (!session) {
    return false
  }
  const st = String(/** @type {any} */ (session).status || '')
  return st === 'approved' || st === 'active'
}
