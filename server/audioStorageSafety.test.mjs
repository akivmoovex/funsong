import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import { tmpdir } from 'node:os'
import {
  absolutePathForStorageKey,
  getAudioStorageRoot,
  isPathUnderStorageRoot,
  pathsForNewUpload
} from './src/audio/paths.mjs'
import { mapSongRow } from './src/db/repos/songsRepo.mjs'

const goodSongId = 'a1b2c3d4-e5f6-4a0b-8c9d-111111111111'
const goodKey =
  'songs/a1b2c3d4-e5f6-4a0b-8c9d-111111111111/abcdabcdabcdabcdabcdabcdabcdabcd.mp3'

describe('audio storage path safety', () => {
  const save = { ...process.env }

  beforeEach(() => {
    process.env = { ...save }
    process.env.AUDIO_STORAGE_DIR = path.join(tmpdir(), 'funsong-audio-test-' + String(process.pid))
  })

  afterEach(() => {
    process.env = { ...save }
  })

  it('rejects storage keys that look like path traversal (not matching strict key pattern)', () => {
    const bad = [
      'songs/a1b2c3d4-e5f6-4a0b-8c9d-111111111111/../../etc/passwd',
      'songs/a1b2c3d4-e5f6-4a0b-8c9d-111111111111/../x.mp3',
      '../songs/x/x.mp3',
      'C:\\\\Windows\\\\file.mp3',
      'songs/a1b2c3d4-e5f6-4a0b-8c9d-111111111111/short.mp3' // name must be 32 hex
    ]
    for (const k of bad) {
      expect(() => absolutePathForStorageKey(k), `key: ${k}`).toThrow(/invalid_storage_key/)
    }
  })

  it('resolves a valid storage key to a path under AUDIO_STORAGE_DIR', () => {
    const root = getAudioStorageRoot()
    const abs = absolutePathForStorageKey(goodKey)
    expect(isPathUnderStorageRoot(abs, root)).toBe(true)
    expect(abs.startsWith(root + path.sep)).toBe(true)
  })

  it('pathsForNewUpload generates a key under the storage root', async () => {
    const { storageKey, absPath, dir } = await pathsForNewUpload(goodSongId)
    expect(storageKey).toMatch(/^songs\//)
    expect(absPath).toBe(path.join(dir, path.basename(absPath)))
    const root = getAudioStorageRoot()
    expect(isPathUnderStorageRoot(absPath, root)).toBe(true)
  })

  it('mapSongRow does not expose audio_storage_key in API shape', () => {
    const row = {
      id: goodSongId,
      title: 'T',
      movie_name: null,
      original_artist: null,
      composer: null,
      lyricist: null,
      year: null,
      duration_ms: 1000,
      difficulty: null,
      status: 'draft',
      rights_status: 'licensed',
      is_default_suggestion: false,
      instrumental_audio_path: null,
      audio_file_url: '/api/songs/' + goodSongId + '/audio',
      audio_mime_type: 'audio/mpeg',
      /** @type {any} */ audio_storage_key: 'songs/x/y.mp3',
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tag_list: []
    }
    const m = mapSongRow(/** @type {any} */ (row))
    expect(m).not.toHaveProperty('audioStorageKey')
    expect(/** @type {any} */ (m).audioFileUrl).toBe('/api/songs/' + goodSongId + '/audio')
  })
})
