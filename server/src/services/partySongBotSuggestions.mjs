import { listSongsForBotSelection } from '../db/repos/songsRepo.mjs'

/** Tags that raise bot mood score (internal library only). */
const MOOD_TAG_KEYS = new Set(['easy', 'party', 'classic', 'romantic', 'hebrew_ready', 'group_friendly'])

/**
 * @param {string | null | undefined} tag
 * @returns {string}
 */
export function normalizeTagForBot(tag) {
  return String(tag || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

/**
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 * @returns {Set<string>}
 */
export function tokenizePartyContext(a, b) {
  const raw = [a, b].filter(Boolean).join(' ')
  const m = raw.toLowerCase().match(/[a-z0-9\u0590-\u05ff]{2,}/gi)
  if (!m) {
    return new Set()
  }
  return new Set(m.map((x) => x.toLowerCase()))
}

/**
 * @param {string[]} tags
 * @returns {number}
 */
function moodTagScore(tags) {
  let s = 0
  for (const t of tags) {
    if (MOOD_TAG_KEYS.has(normalizeTagForBot(t))) {
      s += 1
    }
  }
  return s
}

/**
 * @param {object} song
 * @param {Set<string>} keywords
 * @returns {number}
 */
function keywordScoreForSong(song, keywords) {
  if (!keywords.size) {
    return 0
  }
  const hay = [song.title, song.movieName, song.originalArtist, ...(song.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  let s = 0
  for (const kw of keywords) {
    if (kw.length < 2) {
      continue
    }
    if (hay.includes(kw)) {
      s += 3
    }
  }
  return s
}

/**
 * @param {object} song — mapSongRow shape
 * @returns {number}
 */
export function botSortScore(song, keywords) {
  const tags = song.tags || []
  let sc = 0
  if (song.isDefaultSuggestion) {
    sc += 1_000_000
  }
  sc += moodTagScore(tags) * 10_000
  sc += keywordScoreForSong(song, keywords) * 1_000
  return sc
}

/**
 * One display line for the host (V1 set).
 * @param {object} song
 * @returns {string}
 */
export function selectBotReason(song) {
  const tags = (song.tags || []).map((t) => normalizeTagForBot(t))
  const tagSet = new Set(tags)
  if (tagSet.has('hebrew_ready')) {
    return 'Hebrew-ready'
  }
  const easy =
    tagSet.has('easy') ||
    String(song.difficulty || '')
      .toLowerCase()
      .includes('easy')
  if (tagSet.has('group_friendly') && easy) {
    return 'Easy group song'
  }
  if (tagSet.has('party')) {
    return 'Party pick'
  }
  return 'Complete MP3 + lyrics'
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} sessionId
 * @param {{ description?: string | null; partyName?: string | null; limit?: number }} ctx
 * @returns {Promise<Array<{
 *   id: string
 *   title: string
 *   difficulty: string | null
 *   tags: string[]
 *   audioReady: boolean
 *   lyricsReady: boolean
 *   isDefaultSuggestion: boolean
 *   reason: string
 * }>>}
 */
export async function buildBotSuggestions(pool, sessionId, ctx) {
  const limit = ctx.limit != null && ctx.limit > 0 ? Math.min(ctx.limit, 50) : 20
  const rows = await listSongsForBotSelection(sessionId, pool)
  const keywords = tokenizePartyContext(ctx.description, ctx.partyName)
  const withMeta = rows.map((s) => ({
    song: s,
    score: botSortScore(s, keywords),
    reason: selectBotReason(s)
  }))
  withMeta.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return String(a.song.title || '').localeCompare(String(b.song.title || ''), undefined, {
      sensitivity: 'base'
    })
  })
  return withMeta.slice(0, limit).map(({ song, reason }) => ({
    id: song.id,
    title: song.title,
    difficulty: song.difficulty,
    tags: song.tags,
    audioReady: true,
    lyricsReady: true,
    isDefaultSuggestion: song.isDefaultSuggestion,
    reason
  }))
}
