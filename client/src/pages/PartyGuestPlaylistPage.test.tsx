import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
                  requestedByGuestId: 'guest-1',
                  requestedByGuestDisplayName: 'Alice',
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
      if (url.includes('/api/party/ROOM123/available-songs')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              songs: [
                {
                  id: 'song-2',
                  title: 'Suggested Song',
                  difficulty: 'easy',
                  tags: ['party'],
                  audioReady: true,
                  lyricsReady: true
                }
              ]
            })
        }) as unknown as Promise<Response>
      }
      if (url.includes('/api/party/ROOM123/songs/song-2/preview')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              song: { id: 'song-2', title: 'Suggested Song' },
              languagePreference: 'english',
              previewLines: [
                { lineNumber: 1, text: 'Line one' },
                { lineNumber: 2, text: 'Line two' }
              ]
            })
        }) as unknown as Promise<Response>
      }
      if (url.includes('/api/party/ROOM123/request-song')) {
        return Promise.resolve({
          status: 201,
          ok: true,
          json: () => Promise.resolve({ request: { id: 'req-1' } })
        }) as unknown as Promise<Response>
      }
      if (url.includes('/api/party/ROOM123/leave')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, redirect: '/' })
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
    await waitFor(() => {
      expect(typeof socketHandlers['party:ended']).toBe('function')
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

  it('leave party redirects guest to homepage', async () => {
    render(
      <MemoryRouter initialEntries={['/party/ROOM123/playlist']}>
        <Routes>
          <Route path="/party/:partyCode/playlist" element={<PartyGuestPlaylistPage />} />
          <Route path="/" element={<p>Home screen</p>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Leave party/i }).length).toBeGreaterThan(0)
    })
    fireEvent.click(screen.getAllByRole('button', { name: /Leave party/i })[0])

    await waitFor(() => {
      expect(screen.getByText(/Home screen/i)).toBeInTheDocument()
    })
  })

  it('shows available songs, lyric preview, and suggest action', async () => {
    render(
      <MemoryRouter initialEntries={['/party/ROOM123/playlist']}>
        <Routes>
          <Route path="/party/:partyCode/playlist" element={<PartyGuestPlaylistPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText(/Available Songs/i).length).toBeGreaterThan(0)
    })
    expect(screen.getByText(/Suggested Song/i)).toBeInTheDocument()
    expect(screen.getByText(/Requested by Alice/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Preview lyrics/i }))
    await waitFor(() => {
      expect(screen.getByText(/Line one/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Suggest song/i }))
    await waitFor(() => {
      expect(screen.getByText(/Nice — the host’s list got your request!/i)).toBeInTheDocument()
    })
  })
})
