/**
 * FunSong V1 flow — traceability + a few cross-cutting rules.
 *
 * | # | Scenario | Primary test file(s) |
 * |---|----------|----------------------|
 * | 1 | Super admin login | `auth.test.mjs` |
 * | 2 | Host login | `auth.test.mjs` |
 * | 3 | Host creates party request | `hostPartyRequests.test.mjs` |
 * | 4 | Pending: no QR | `hostPartyQr.test.mjs` |
 * | 5 | Admin approves | `adminParty.test.mjs` |
 * | 6 | Session max_guests (default 30) | `partyRequestApproval.test.mjs` |
 * | 7 | QR / join after approve | `hostPartyQr.test.mjs` |
 * | 8 | Guest join + name + language | `guestJoinService.test.mjs`, `guestJoin.test.mjs` |
 * | 9 | 31st guest / full | `guestJoinService.test.mjs`, `guestJoin.test.mjs` |
 * | 10 | Admin published song | `adminSongs.test.mjs` |
 * | 11 | Admin lyrics | `lyricLinesApi.test.mjs` |
 * | 12 | Host add to playlist | `playlist.test.mjs` |
 * | 13 | Host start song | `partyKaraoke.test.mjs` |
 * | 14 | Guest request control | `partyControl.test.mjs` |
 * | 15 | Host approves control | `v1HostControlApprove.test.mjs` |
 * | 16 | Controller lyric next | `lyricLineControl.test.mjs` |
 * | 17 | Room state broadcast | `partyRealtime.test.mjs`, `partySocket.test.mjs` (Socket.IO) |
 * | 18 | Non-controller cannot control | this file + `lyricLineControl.test.mjs` |
 * | 19 | Host take back control | `v1HostTakeControl.test.mjs` |
 * | 20 | End song (karaoke) | `partyKaraoke.test.mjs` |
 * | 21 | Host ends party → status ended, join blocked | `hostEndParty.test.mjs`, `guestJoinService.test.mjs` |
 * | 22 | Disabled blocks join / control / start | `guestJoinService.test.mjs`, `lyricLineControl.test.mjs`, `partySongControl.test.mjs` |
 */
import { describe, expect, it } from 'vitest'
import { canControlLyrics } from './src/services/lyricLineControl.mjs'
import { sessionAllowsLivePartyControl } from './src/services/partySessionPolicy.mjs'

const G_CTRL = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'
const G_OTHER = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'

describe('V1 flow — guest lyric permission (scenario 18)', () => {
  it('a guest who is not the current controller cannot control lyrics', () => {
    const session = { current_controller_party_guest_id: G_CTRL }
    expect(
      canControlLyrics(/** @type {any} */ (session), { role: 'guest', partyGuestId: G_OTHER })
    ).toBe(false)
  })
})

describe('V1 flow — live session policy (ended / disabled vs scenarios 20–22)', () => {
  it('rejects “live” ops when session is ended', () => {
    expect(sessionAllowsLivePartyControl(/** @type {any} */ ({ status: 'ended' }))).toBe(false)
  })
  it('rejects when session is admin-disabled', () => {
    expect(sessionAllowsLivePartyControl(/** @type {any} */ ({ status: 'disabled' }))).toBe(false)
  })
  it('rejects when status is pending on the request side only (not a live party session row)', () => {
    expect(sessionAllowsLivePartyControl(/** @type {any} */ ({ status: 'pending' }))).toBe(false)
  })
  it('allows when approved (typical pre-karaoke room)', () => {
    expect(sessionAllowsLivePartyControl(/** @type {any} */ ({ status: 'approved' }))).toBe(true)
  })
  it('allows when active', () => {
    expect(sessionAllowsLivePartyControl(/** @type {any} */ ({ status: 'active' }))).toBe(true)
  })
})
