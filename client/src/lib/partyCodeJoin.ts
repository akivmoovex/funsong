/**
 * Aligned with server `apiGuestJoin` party code param validation.
 * Codes are case-sensitive in the database — preserve casing after trim.
 */
export const PARTY_CODE_RE = /^[A-Za-z0-9._-]{4,64}$/

export type PartyCodeValidation = 'ok' | 'empty' | 'invalid'

export function preparePartyCodeForJoin(raw: string): string {
  return String(raw ?? '').trim()
}

export function validatePartyCodeForJoin(prepared: string): PartyCodeValidation {
  if (!prepared) {
    return 'empty'
  }
  if (!PARTY_CODE_RE.test(prepared)) {
    return 'invalid'
  }
  return 'ok'
}
