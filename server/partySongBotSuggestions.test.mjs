import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildBotSuggestions, selectBotReason, tokenizePartyContext } from './src/services/partySongBotSuggestions.mjs'
import * as songsRepo from './src/db/repos/songsRepo.mjs'

vi.mock('./src/db/repos/songsRepo.mjs', () => ({
  listSongsForBotSelection: vi.fn()
}))

const { listSongsForBotSelection } = songsRepo

const base = {
  movieName: null,
  originalArtist: null
}

function song(over) {
  return { tags: [], difficulty: null, isDefaultSuggestion: false, ...base, ...over }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('selectBotReason', () => {
  it('Hebrew-ready', () => {
    expect(
      selectBotReason(song({ tags: ['hebrew_ready', 'party'] }))
    ).toBe('Hebrew-ready')
  })
  it('Easy group song', () => {
    expect(
      selectBotReason(song({ tags: ['easy', 'group_friendly'] }))
    ).toBe('Easy group song')
  })
  it('Party pick', () => {
    expect(selectBotReason(song({ tags: ['party', 'classic'] }))).toBe('Party pick')
  })
  it('Complete MP3 + lyrics as fallback', () => {
    expect(selectBotReason(song({ tags: ['romantic', 'classic'] }))).toBe('Complete MP3 + lyrics')
  })
})

describe('buildBotSuggestions', () => {
  it('prioritizes default suggestions over non-defaults', async () => {
    const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    listSongsForBotSelection.mockResolvedValue([
      song({ id: a, title: 'Second', isDefaultSuggestion: false }),
      song({ id: b, title: 'First', isDefaultSuggestion: true })
    ])
    const out = await buildBotSuggestions(/** @type {any} */ ({}), 'ssssssss-ssss-4sss-8sss-ssssssssssss', {})
    expect(out[0].id).toBe(b)
    expect(out[1].id).toBe(a)
  })

  it('ranks by keyword from party request when both non-default (mock order)', async () => {
    listSongsForBotSelection.mockResolvedValue([
      song({ id: '1', title: 'Other', tags: [] }),
      song({ id: '2', title: 'Birthday Bash', tags: [] })
    ])
    const out = await buildBotSuggestions(/** @type {any} */ ({}), 's', {
      description: 'birthday celebration'
    })
    expect(out[0].id).toBe('2')
  })
})

describe('tokenizePartyContext', () => {
  it('extracts keywords for matching', () => {
    const s = tokenizePartyContext('Office holiday party', 'New Year')
    expect(s.has('holiday')).toBe(true)
    expect(s.has('year')).toBe(true)
  })
})
