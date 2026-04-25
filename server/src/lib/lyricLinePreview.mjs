/**
 * Text for a trilingual line in the selected preview language (fallback to other langs).
 * @param {{ textEnglish?: string | null; textHindi?: string | null; textHebrew?: string | null }} line
 * @param {'en' | 'hi' | 'he'} mode
 * @returns {string}
 */
export function previewTextForLine(line, mode) {
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
