import { describe, expect, it } from 'vitest'
import { previewTextForLine } from './lyricPreview'

describe('lyricPreview', () => {
  it('he mode falls back to en then hi when he empty', () => {
    expect(
      previewTextForLine(
        { textEnglish: 'en', textHindi: 'hi', textHebrew: '' },
        'he'
      )
    ).toBe('en')
  })
})
