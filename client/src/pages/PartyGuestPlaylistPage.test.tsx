import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PartyGuestPlaylistPage } from './PartyGuestPlaylistPage'

let socketHandlers = /** @type {Record<string, (payload?: any) => void>} */ ({})

vi.mock('../realtime/partySocket', () => ({
  createPartySocket: () => ({
    on: vi.fn((event: string, cb: (payload?: any) => void) => {
      socketHandlers[event] = cb
    }),
    off: vi.fn(),
    close: vi.fn()
  })
}))

describe('PartyGuestPlaylistPage end-party sync', () => {
  beforeEach(() => {
    socketHandlers = {}
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/party/ROOM123')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              session: { id: 'sess-1', status: 'active' }
            })
        }) as unknown as Promise<Response>
      }
      if (url.includes('/api/party/ROOM123/playlist')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              playlist: [
                {
                  playlistItemId: 'p1',
                  position: 0,
                  status: 'queued',
                  id: 'song-1',
                  title: 'Song One',
                  difficulty: null,
                  tags: [],
                  audioReady: true,
                  lyricsReady: true
                }
              ]
            })
        }) as unknown as Promise<Response>
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      }) as unknown as Promise<Response>
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows ended screen immediately on party:ended socket event', async () => {
    render(
      <MemoryRouter initialEntries={['/party/ROOM123/playlist']}>
        <Routes>
          <Route path="/party/:partyCode/playlist" element={<PartyGuestPlaylistPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Song One/i)).toBeInTheDocument()
    })

    socketHandlers['party:ended']?.({ source: 'host' })

    await waitFor(() => {
      expect(screen.getByText(/This party has ended/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Song requests and controls are no longer available/i)).toBeInTheDocument()
  })

  it('shows ended screen when playlist API returns not_available (race after end)', async () => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/party/ROOM123')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              session: { id: 'sess-1', status: 'active' }
            })
        }) as unknown as Promise<Response>
      }
      if (url.includes('/api/party/ROOM123/playlist')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: 'not_available' })
        }) as unknown as Promise<Response>
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      }) as unknown as Promise<Response>
    }) as unknown as typeof fetch

    render(
      <MemoryRouter initialEntries={['/party/ROOM123/playlist']}>
        <Routes>
          <Route path="/party/:partyCode/playlist" element={<PartyGuestPlaylistPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/This party has ended/i)).toBeInTheDocument()
    })
  })
})
