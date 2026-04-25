import { describe, expect, it } from 'vitest'
import { canControlPartyAudio } from './src/services/partyAudioControl.mjs'

describe('canControlPartyAudio', () => {
  it('allows host and admin', () => {
    const s = { current_controller_party_guest_id: 'g1', controller_audio_enabled: false }
    expect(
      canControlPartyAudio(/** @type {any} */ (s), { role: 'host', partyGuestId: null })
    ).toBe(true)
    expect(
      canControlPartyAudio(/** @type {any} */ (s), { role: 'admin', partyGuestId: null })
    ).toBe(true)
  })

  it('allows guest only when they are controller and host enabled guest audio', () => {
    const s = { current_controller_party_guest_id: 'g1', controller_audio_enabled: true }
    expect(
      canControlPartyAudio(/** @type {any} */ (s), { role: 'guest', partyGuestId: 'g1' })
    ).toBe(true)
    expect(
      canControlPartyAudio(/** @type {any} */ (s), { role: 'guest', partyGuestId: 'g2' })
    ).toBe(false)
  })

  it('denies guest when controller audio is off', () => {
    const s = { current_controller_party_guest_id: 'g1', controller_audio_enabled: false }
    expect(
      canControlPartyAudio(/** @type {any} */ (s), { role: 'guest', partyGuestId: 'g1' })
    ).toBe(false)
  })
})
