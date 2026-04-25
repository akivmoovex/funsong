import { describe, expect, it } from 'vitest'
import { preparePartyCodeForJoin, validatePartyCodeForJoin } from './partyCodeJoin'

describe('partyCodeJoin', () => {
  it('trims whitespace', () => {
    expect(preparePartyCodeForJoin('  abc-12  ')).toBe('abc-12')
  })

  it('preserves case (server lookup is case-sensitive)', () => {
    expect(preparePartyCodeForJoin('  Xy9aA  ')).toBe('Xy9aA')
  })

  it('validate: empty, invalid, ok', () => {
    expect(validatePartyCodeForJoin('')).toBe('empty')
    expect(validatePartyCodeForJoin(preparePartyCodeForJoin('  '))).toBe('empty')
    expect(validatePartyCodeForJoin('ab')).toBe('invalid')
    expect(validatePartyCodeForJoin('!!!')).toBe('invalid')
    expect(validatePartyCodeForJoin('Valid12-x')).toBe('ok')
  })
})
