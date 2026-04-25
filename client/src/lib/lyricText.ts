/**
 * Picks a single language string for display (aligns with server `pickLineTextForLanguage`).
 */
export type Triline = {
  textEnglish?: string
  textHindi?: string
  textHebrew?: string
}

export function pickLineText(line: Triline | null | undefined, languagePreference: string): string | null {
  if (!line) {
    return null
  }
  const lang = String(languagePreference).toLowerCase()
  if (lang === 'hindi') {
    const t = String(line.textHindi || '').trim()
    return t || String(line.textEnglish || '').trim() || null
  }
  if (lang === 'hebrew') {
    const t = String(line.textHebrew || '').trim()
    return t || String(line.textEnglish || '').trim() || null
  }
  const t = String(line.textEnglish || '').trim()
  return t || String(line.textHindi || line.textHebrew || '').trim() || null
}
