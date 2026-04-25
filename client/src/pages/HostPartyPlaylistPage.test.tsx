import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BusyOverlayProvider } from '../components/busy/BusyOverlayProvider'
import { HostPartyPlaylistPage } from './HostPartyPlaylistPage'

vi.mock('../realtime/partySocket', () => ({
  createPartySocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
    close: vi.fn(),
    emit: vi.fn()
  })
}))

describe('HostPartyPlaylistPage start flow', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/host/parties/') && url.endsWith('/playlist')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              partySessionId: 'sess-1',
              playlist: [
                {
                  playlistItemId: 'item-1',
                  position: 0,
                  itemStatus: 'pending',
                  id: 'song-1',
                  title: 'First Song',
                  difficulty: 'easy',
                  tags: [],
                  audioReady: true,
                  lyricsReady: true
                }
              ],
              availableSongs: [],
              suggestions: [],
              botSuggestions: [],
              maxPlaylistSongs: 10,
              maxGuests: 30
            })
        }) as unknown as Promise<Response>
      }
      if (url.endsWith('/api/account/my-songs')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ songs: [] })
        }) as unknown as Promise<Response>
      }
      if (url.endsWith('/control-requests') || url.endsWith('/song-requests')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ requests: [] })
        }) as unknown as Promise<Response>
      }
      if (url.endsWith('/start-party')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, state: { sessionStatus: 'active', activeSong: null } })
        }) as unknown as Promise<Response>
      }
      if (url.endsWith('/start-song')) {
        const body = init?.body ? JSON.parse(String(init.body)) : {}
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              state: {
                sessionStatus: 'active',
                activeSong: { id: 'song-1', title: 'First Song' },
                activePlaylistItemId: body.playlistItemId,
                lyricLines: [{ lineNumber: 1, textEnglish: 'Hello' }],
                currentLine: { lineNumber: 1, textEnglish: 'Hello' }
              }
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

  it('shows Start first song after Start party and starts first queued item', async () => {
    render(
      <MemoryRouter initialEntries={['/host/parties/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/playlist']}>
        <BusyOverlayProvider>
          <Routes>
            <Route path="/host/parties/:partyId/playlist" element={<HostPartyPlaylistPage />} />
          </Routes>
        </BusyOverlayProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Start party/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Start party/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Start first song/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Start first song/i }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/start-song'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ playlistItemId: 'item-1' })
        })
      )
    })
  })

  it('shows guest song requests with guest name and queue requested-by label', async () => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/host/parties/') && url.endsWith('/playlist')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              partySessionId: 'sess-1',
              playlist: [
                {
                  playlistItemId: 'item-1',
                  position: 0,
                  itemStatus: 'pending',
                  requestedByGuestId: 'guest-1',
                  requestedByGuestDisplayName: 'Alice',
                  id: 'song-1',
                  title: 'First Song',
                  difficulty: 'easy',
                  tags: [],
                  audioReady: true,
                  lyricsReady: true
                }
              ],
              availableSongs: [],
              suggestions: [],
              botSuggestions: [],
              maxPlaylistSongs: 10,
              maxGuests: 30
            })
        }) as unknown as Promise<Response>
      }
      if (url.endsWith('/api/account/my-songs')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ songs: [] })
        }) as unknown as Promise<Response>
      }
      if (url.endsWith('/control-requests')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ requests: [] })
        }) as unknown as Promise<Response>
      }
      if (url.endsWith('/song-requests')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              requests: [
                {
                  id: 'req-1',
                  partyGuestId: 'guest-1',
                  guestDisplayName: 'Alice',
                  songId: 'song-1',
                  songTitle: 'First Song',
                  status: 'pending',
                  createdAt: '2026-01-01T00:00:00.000Z'
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

    render(
      <MemoryRouter initialEntries={['/host/parties/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/playlist']}>
        <BusyOverlayProvider>
          <Routes>
            <Route path="/host/parties/:partyId/playlist" element={<HostPartyPlaylistPage />} />
          </Routes>
        </BusyOverlayProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: /Guest Song Requests/i }).length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText(/Requested by Alice/i).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Approve/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Reject/i }).length).toBeGreaterThan(0)
  })
})
