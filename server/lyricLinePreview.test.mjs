import { describe, expect, it } from 'vitest'
import { previewTextForLine } from './src/lib/lyricLinePreview.mjs'

describe('previewTextForLine', () => {
  it('prefers English in en mode', () => {
    expect(
      previewTextForLine(
        { textEnglish: 'A', textHindi: 'B', textHebrew: 'C' },
        'en'
      )
    ).toBe('A')
  })

  it('falls back en mode to hi then he', () => {
    expect(
      previewTextForLine({ textEnglish: '', textHindi: 'B', textHebrew: '' }, 'en')
    ).toBe('B')
  })

  it('hi mode prefers Hindi', () => {
    expect(
      previewTextForLine(
        { textEnglish: 'A', textHindi: 'न', textHebrew: 'ע' },
        'hi'
      )
    ).toBe('न')
  })
})
