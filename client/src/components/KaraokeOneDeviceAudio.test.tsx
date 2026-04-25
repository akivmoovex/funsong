import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { KaraokeOneDeviceAudio } from './KaraokeOneDeviceAudio'

afterEach(() => {
  cleanup()
})

describe('KaraokeOneDeviceAudio', () => {
  it('renders host player when host variant and audio URL exists', () => {
    render(
      <KaraokeOneDeviceAudio
        variant="host"
        partyRequestId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        activeSong={{ id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', audioFileUrl: '/api/songs/b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10/audio' }}
        playbackStatus="playing"
      />
    )
    expect(screen.getByTestId('karaoke-audio-block')).toBeInTheDocument()
    expect(screen.getByTestId('karaoke-audio')).toBeInTheDocument()
    expect(screen.getByLabelText('Play instrumental')).toBeInTheDocument()
  })

  it('does not render player for lyrics-only (normal guest)', () => {
    const { container } = render(
      <KaraokeOneDeviceAudio variant="lyrics-only" activeSong={{ id: 'x', audioFileUrl: '/api/songs/x/audio' }} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('does not expose a download control or link', () => {
    render(
      <KaraokeOneDeviceAudio
        variant="host"
        partyRequestId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        activeSong={{ id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', audioFileUrl: '/a' }}
      />
    )
    const el = screen.getByTestId('karaoke-audio') as HTMLAudioElement
    expect(el.controls).toBe(false)
    expect(screen.queryByRole('link', { name: /download/i })).toBeNull()
  })

  it('shows empty state when there is no audio file on the song', () => {
    render(
      <KaraokeOneDeviceAudio
        variant="host"
        partyRequestId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        activeSong={{ id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a10', audioFileUrl: null }}
      />
    )
    expect(screen.getByTestId('karaoke-audio-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('karaoke-audio')).toBeNull()
  })
})
