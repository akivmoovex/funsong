import { listLinesForSong } from '../db/repos/lyricLinesRepo.mjs'
import { appendEvent } from '../db/repos/partyEventsRepo.mjs'
import { setPartySongPlaybackOp } from './partySongControl.mjs'
import { findSessionById, updateSessionCurrentLine } from '../db/repos/partySessionsRepo.mjs'
import { sessionAllowsLivePartyControl } from './partySessionPolicy.mjs'

/**
 * @param {Record<string, unknown>} session
 * @param {{ role: 'guest' | 'host' | 'admin'; partyGuestId: string | null }} a
 * @returns {boolean}
 */
export function canControlLyrics(session, a) {
  const { role, partyGuestId } = a
  if (role === 'host' || role === 'admin') {
    return true
  }
  if (role === 'guest' && partyGuestId && session.current_controller_party_guest_id) {
    return String(session.current_controller_party_guest_id) === String(partyGuestId)
  }
  return false
}

/**
 * First line to show when restarting: line `1` if present, else minimum line number.
 * @param {number[]} sortedAsc
 */
export function restartLineFromSorted(sortedAsc) {
  if (sortedAsc.length === 0) {
    return 1
  }
  const has1 = sortedAsc.includes(1)
  return has1 ? 1 : Math.min(...sortedAsc)
}

/**
 * @param {number[]} sortedAsc
 * @param {number} current
 * @returns {{ nextLine: number; finishSong: boolean }}
 */
export function lineAfterNext(sortedAsc, current) {
  if (sortedAsc.length === 0) {
    return { nextLine: 1, finishSong: true }
  }
  const j = sortedAsc.findIndex((l) => l > current)
  if (j === -1) {
    return { nextLine: current, finishSong: true }
  }
  return { nextLine: sortedAsc[j], finishSong: false }
}

/**
 * @param {number[]} sortedAsc
 * @param {number} current
 */
export function lineAfterPrevious(sortedAsc, current) {
  if (sortedAsc.length === 0) {
    return 1
  }
  const minL = sortedAsc[0]
  const candidates = sortedAsc.filter((l) => l < current)
  if (candidates.length === 0) {
    return minL
  }
  return candidates[candidates.length - 1]
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} sessionId
 * @param {'next' | 'previous' | 'restart' | 'jump' | 'finish'} action
 * @param {{ lineNumber?: number }} [payload]
 * @returns {Promise<
 *   | { ok: true; finished: true; endResult: Awaited<ReturnType<typeof setPartySongPlaybackOp>> }
 *   | { ok: true; finished: false; currentLineNumber: number }
 *   | { ok: false; error: string; endResult?: Awaited<ReturnType<typeof setPartySongPlaybackOp>> }
 * >}
 */
export async function applyLyricLineAction(pool, sessionId, action, payload) {
  if (!pool) {
    return { ok: false, error: 'no_database' }
  }
  let session = await findSessionById(sessionId, pool)
  if (!session) {
    return { ok: false, error: 'not_found' }
  }
  if (!sessionAllowsLivePartyControl(session)) {
    return { ok: false, error: 'session_closed' }
  }
  if (!/** @type {any} */ (session).active_song_id) {
    return { ok: false, error: 'no_active_song' }
  }

  const songId = String(/** @type {any} */ (session).active_song_id)
  const lines = await listLinesForSong(songId, pool)
  const sortedAsc = [...new Set(lines.map((l) => l.lineNumber))].sort((a, b) => a - b)
  if (sortedAsc.length === 0) {
    return { ok: false, error: 'no_lyrics' }
  }
  const minL = sortedAsc[0]
  const maxL = sortedAsc[sortedAsc.length - 1]
  const current = Number(/** @type {any} */ (session).current_line_number ?? minL)

  if (current > maxL) {
    const end = await setPartySongPlaybackOp(
      pool,
      await findSessionById(sessionId, pool) || session,
      'end'
    )
    if (!end.ok) {
      return { ok: false, error: end.error, endResult: end }
    }
    return { ok: true, finished: true, endResult: end }
  }

  if (action === 'finish') {
    const end = await setPartySongPlaybackOp(pool, session, 'end')
    if (!end.ok) {
      return { ok: false, error: end.error, endResult: end }
    }
    return { ok: true, finished: true, endResult: end }
  }

  if (action === 'next') {
    const { nextLine, finishSong } = lineAfterNext(sortedAsc, current)
    if (finishSong) {
      session = (await findSessionById(sessionId, pool)) || session
      const end = await setPartySongPlaybackOp(pool, session, 'end')
      if (!end.ok) {
        return { ok: false, error: end.error, endResult: end }
      }
      return { ok: true, finished: true, endResult: end }
    }
    const row = await updateSessionCurrentLine(sessionId, nextLine, pool)
    if (!row) {
      return { ok: false, error: 'update_failed' }
    }
    try {
      await appendEvent(
        {
          sessionId,
          eventType: 'karaoke:lyric_line',
          payload: { action, lineNumber: nextLine }
        },
        pool
      )
    } catch {
      // ignore
    }
    return { ok: true, finished: false, currentLineNumber: nextLine }
  }

  if (action === 'previous') {
    const newLine = lineAfterPrevious(sortedAsc, current)
    const row = await updateSessionCurrentLine(sessionId, newLine, pool)
    if (!row) {
      return { ok: false, error: 'update_failed' }
    }
    try {
      await appendEvent(
        {
          sessionId,
          eventType: 'karaoke:lyric_line',
          payload: { action, lineNumber: newLine }
        },
        pool
      )
    } catch {
      // ignore
    }
    return { ok: true, finished: false, currentLineNumber: newLine }
  }

  if (action === 'restart') {
    const rLine = restartLineFromSorted(sortedAsc)
    const row = await updateSessionCurrentLine(sessionId, rLine, pool)
    if (!row) {
      return { ok: false, error: 'update_failed' }
    }
    try {
      await appendEvent(
        {
          sessionId,
          eventType: 'karaoke:lyric_line',
          payload: { action, lineNumber: rLine }
        },
        pool
      )
    } catch {
      // ignore
    }
    return { ok: true, finished: false, currentLineNumber: rLine }
  }

  if (action === 'jump') {
    const n = Number(/** @type {any} */ (payload && payload.lineNumber))
    if (!Number.isFinite(n)) {
      return { ok: false, error: 'invalid_line' }
    }
    if (!sortedAsc.includes(n)) {
      return { ok: false, error: 'invalid_line' }
    }
    const row = await updateSessionCurrentLine(sessionId, n, pool)
    if (!row) {
      return { ok: false, error: 'update_failed' }
    }
    try {
      await appendEvent(
        {
          sessionId,
          eventType: 'karaoke:lyric_line',
          payload: { action, lineNumber: n }
        },
        pool
      )
    } catch {
      // ignore
    }
    return { ok: true, finished: false, currentLineNumber: n }
  }

  return { ok: false, error: 'invalid_action' }
}
