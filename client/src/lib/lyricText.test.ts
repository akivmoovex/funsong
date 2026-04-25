import { describe, expect, it } from 'vitest'
import { pickLineText } from './lyricText'

describe('pickLineText', () => {
  it('uses language_preference (hindi with fallback)', () => {
    expect(
      pickLineText({ textEnglish: 'e', textHindi: 'ह', textHebrew: '' }, 'hindi')
    ).toBe('ह')
  })

  it('returns null for empty line', () => {
    expect(pickLineText(null, 'english')).toBeNull()
  })
})
