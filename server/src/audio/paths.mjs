import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// server/src/audio -> repo root
const repoRoot = path.join(__dirname, '../../..')
const defDir = path.join(repoRoot, 'data', 'audio')

/**
 * @param {string} candidatePath absolute or normalized
 * @param {string} rootDir absolute base directory; files must be strictly under this tree
 * @returns {boolean}
 */
export function isPathUnderStorageRoot(candidatePath, rootDir) {
  const f = path.resolve(candidatePath)
  const r = path.resolve(rootDir)
  const rel = path.relative(r, f)
  if (rel === '') {
    return false
  }
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return false
  }
  return true
}

/**
 * @returns {string} Absolute base directory; never from client request bodies.
 * Production requires `AUDIO_STORAGE_DIR` to be set (see assertProductionEnv).
 */
export function getAudioStorageRoot() {
  const raw = process.env.AUDIO_STORAGE_DIR
  const d = (raw == null || String(raw).trim() === '' ? defDir : String(raw).trim())
  if (!d) {
    return path.resolve(defDir)
  }
  return path.isAbsolute(d) ? path.resolve(d) : path.resolve(repoRoot, d)
}

/** Opaque key allowed in DB, e.g. `songs/{uuid}/abc.mp3` */
const KEY_RE = /^songs\/[0-9a-f-]{36}\/[a-f0-9]{32}\.mp3$/

/**
 * @param {string} storageKey
 * @returns {string} absolute file path, or throws if key is invalid
 */
export function absolutePathForStorageKey(storageKey) {
  if (typeof storageKey !== 'string' || !KEY_RE.test(storageKey)) {
    throw new Error('invalid_storage_key')
  }
  const base = getAudioStorageRoot()
  const abs = path.resolve(base, ...storageKey.split('/').filter((s) => s.length > 0))
  if (!isPathUnderStorageRoot(abs, base)) {
    const e = new Error('invalid_storage_key')
    e.code = 'STORAGE'
    throw e
  }
  return abs
}

/**
 * @param {string} songId uuid
 * @returns {{ storageKey: string, dir: string, absPath: string }}
 */
export async function pathsForNewUpload(songId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(songId)) {
    throw new Error('invalid_song_id')
  }
  const crypto = await import('node:crypto')
  const r = crypto.randomBytes(16).toString('hex')
  const storageKey = `songs/${songId.toLowerCase()}/${r}.mp3`
  const base = getAudioStorageRoot()
  const dir = path.resolve(base, 'songs', songId.toLowerCase())
  const absPath = path.resolve(base, ...storageKey.split('/').filter((s) => s.length > 0))
  if (!isPathUnderStorageRoot(absPath, base)) {
    throw new Error('invalid_song_id')
  }
  return { storageKey, dir, absPath }
}

export function ensureKeyAllowed(storageKey) {
  if (typeof storageKey !== 'string' || !KEY_RE.test(storageKey)) {
    const e = new Error('invalid_storage_key')
    e.code = 'STORAGE'
    throw e
  }
}

/**
 * @param {string} dir
 */
export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true })
}
