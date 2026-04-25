export const BUILT_IN_AVATAR_KEYS = Object.freeze([
  'spark-mic',
  'neon-star',
  'rhythm-wave',
  'vinyl-pop',
  'karaoke-moon',
  'retro-sun',
  'party-bolt',
  'stage-heart',
  'pulse-diamond',
  'echo-flame'
])

const AVATAR_SET = new Set(BUILT_IN_AVATAR_KEYS)

/**
 * @param {string | null | undefined} key
 */
export function isBuiltInAvatarKey(key) {
  if (key == null) return false
  return AVATAR_SET.has(String(key))
}
