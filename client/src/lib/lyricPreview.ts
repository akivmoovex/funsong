export type TrilingualLine = {
  textEnglish?: string | null
  textHindi?: string | null
  textHebrew?: string | null
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
