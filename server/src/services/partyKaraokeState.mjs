import { findSessionById } from '../db/repos/partySessionsRepo.mjs'
import { findSongById } from '../db/repos/songsRepo.mjs'
import { listLinesForSong } from '../db/repos/lyricLinesRepo.mjs'
import { findGuestById } from '../db/repos/partyGuestsRepo.mjs'
import { countConnectedGuestsBySessionId } from '../db/repos/partyGuestsRepo.mjs'

/**
 * @param {{ textEnglish?: string; textHindi?: string; textHebrew?: string } | null} line
 * @param {'english' | 'hindi' | 'hebrew'} lang
 */
export function pickLineTextForLanguage(line, lang) {
  if (!line) return null
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

/**
 * @param {string} sessionId
 * @param {import('pg').Pool} pool
 * @param {{
 *   languagePreference?: 'english' | 'hindi' | 'hebrew'
 *   role?: 'guest' | 'host' | 'admin' | null
 * }} [opt]
 */
export async function buildPartyKaraokeState(sessionId, pool, opt = {}) {
  const { languagePreference = 'english', role = null } = opt
  const session = await findSessionById(sessionId, pool)
  if (!session) {
    return null
  }
  const gu = await countConnectedGuestsBySessionId(sessionId, pool)
  const activeSongId = session.active_song_id
  let activeSong = null
  let lyricLines = /** @type {any[]} */ ([])
  if (activeSongId) {
    activeSong = await findSongById(String(activeSongId), pool)
    lyricLines = await listLinesForSong(String(activeSongId), pool)
  }
  const currentNo = /** @type {number} */ (Number(session.current_line_number ?? 1))
  const currentLine = lyricLines.find((l) => l.lineNumber === currentNo) || null
  const linePayload = (/** @param {any} */ l) => ({
    lineNumber: l.lineNumber,
    startTimeSeconds: l.startTimeSeconds,
    endTimeSeconds: l.endTimeSeconds,
    textEnglish: l.textEnglish,
    textHindi: l.textHindi,
    textHebrew: l.textHebrew
  })
  const publicLines = lyricLines.map((l) => linePayload(l))
  const sortedNums = [...new Set(lyricLines.map((l) => l.lineNumber))].sort((a, b) => a - b)
  const si = sortedNums.indexOf(currentNo)
  let previousLine = null
  let nextLine = null
  if (si > 0) {
    const pl = lyricLines.find((l) => l.lineNumber === sortedNums[si - 1])
    if (pl) {
      previousLine = linePayload(/** @type {any} */ (pl))
    }
  }
  if (si >= 0 && si < sortedNums.length - 1) {
    const nl = lyricLines.find((l) => l.lineNumber === sortedNums[si + 1])
    if (nl) {
      nextLine = linePayload(/** @type {any} */ (nl))
    }
  }
  let controller = null
  if (session.current_controller_party_guest_id) {
    const cg = await findGuestById(String(session.current_controller_party_guest_id), pool)
    if (cg) {
      controller = { id: cg.id, displayName: cg.display_name }
    }
  }
  const cAudio = /** @type {boolean} */ (/** @type {any} */ (session).controller_audio_enabled)
  return {
    sessionId: String(session.id),
    partyCode: session.party_code || null,
    role: role || undefined,
    sessionStatus: String(session.status),
    connectedGuestCount: gu,
    controllerAudioEnabled: cAudio === true,
    playbackStatus: String(session.playback_status),
    currentLineNumber: currentNo,
    activeSong,
    activePlaylistItemId: session.active_playlist_item_id ? String(session.active_playlist_item_id) : null,
    controller,
    lyricLines: publicLines,
    currentLine: currentLine ? linePayload(/** @type {any} */ (currentLine)) : null,
    currentLineText: currentLine
      ? pickLineTextForLanguage(/** @type {any} */ (currentLine), languagePreference) ||
        pickLineTextForLanguage(/** @type {any} */ (currentLine), 'english')
      : null,
    previousLineText: previousLine
      ? pickLineTextForLanguage(/** @type {any} */ (previousLine), languagePreference) ||
        pickLineTextForLanguage(/** @type {any} */ (previousLine), 'english')
      : null,
    nextLineText: nextLine
      ? pickLineTextForLanguage(/** @type {any} */ (nextLine), languagePreference) ||
        pickLineTextForLanguage(/** @type {any} */ (nextLine), 'english')
      : null,
    languagePreference: languagePreference,
    lyricContext: {
      previousLine,
      nextLine
    }
  }
}
