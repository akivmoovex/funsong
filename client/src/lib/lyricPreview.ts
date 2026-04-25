export type TrilingualLine = {
  textEnglish?: string | null
  textHindi?: string | null
  textHebrew?: string | null
}

/**
 * Returns up to 4 line numbers for karaoke display in this order:
 * previous, current, next, next+1.
 */
export function karaokeVisibleLineNumbers(
  allLineNumbers: number[],
  currentLineNumber: number
): number[] {
  const sorted = [...new Set(allLineNumbers.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b)
  const idx = sorted.indexOf(currentLineNumber)
  if (idx < 0) {
    return []
  }
  return [sorted[idx - 1], sorted[idx], sorted[idx + 1], sorted[idx + 2]].filter(
    (n): n is number => Number.isFinite(n)
  )
}

export function previewTextForLine(line: TrilingualLine, mode: 'en' | 'hi' | 'he'): string {
  const en = (line.textEnglish ?? '').trim()
  const hi = (line.textHindi ?? '').trim()
  const he = (line.textHebrew ?? '').trim()
  if (mode === 'hi') {
    return hi || he || en
  }
  if (mode === 'he') {
    return he || en || hi
  }
  return en || hi || he
}
