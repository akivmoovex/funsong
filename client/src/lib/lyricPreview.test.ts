import { describe, expect, it } from 'vitest'
import { karaokeVisibleLineNumbers, previewTextForLine } from './lyricPreview'

describe('lyricPreview', () => {
  it('he mode falls back to en then hi when he empty', () => {
    expect(
      previewTextForLine(
        { textEnglish: 'en', textHindi: 'hi', textHebrew: '' },
        'he'
      )
    ).toBe('en')
  })

  it('line window for first line shows current and following lines', () => {
    expect(karaokeVisibleLineNumbers([1, 2, 3, 4], 1)).toEqual([1, 2, 3])
  })

  it('line window for middle line shows up to 4 lines', () => {
    expect(karaokeVisibleLineNumbers([1, 2, 3, 4, 5], 3)).toEqual([2, 3, 4, 5])
  })

  it('line window for final line shows previous and current only', () => {
    expect(karaokeVisibleLineNumbers([1, 2, 3, 4], 4)).toEqual([3, 4])
  })

  it('line window handles missing next lines', () => {
    expect(karaokeVisibleLineNumbers([1, 3, 5], 3)).toEqual([1, 3, 5])
  })
})
