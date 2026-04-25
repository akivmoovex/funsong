import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PartyLobbyPage } from './PartyLobbyPage'

const socketHandlers = new Map<string, (payload?: any) => void>()

vi.mock('../realtime/partySocket', () => ({
  createPartySocket: () => ({
    on: vi.fn((event: string, handler: (payload?: any) => void) => {
      socketHandlers.set(event, handler)
    }),
    off: vi.fn((event: string) => {
      socketHandlers.delete(event)
    }),
    close: vi.fn()
  })
}))

describe('PartyLobbyPage queue visibility', () => {
  let playlistFetchCount = 0

  beforeEach(() => {
    playlistFetchCount = 0
    socketHandlers.clear()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/join/ABC123')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ preview: { partyTitle: 'Friday Party' } })
        }) as unknown as Promise<Response>
      }
      if (url.endsWith('/api/party/ABC123')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              guest: { id: 'guest-1', displayName: 'Dana', languagePreference: 'english' },
              session: { id: 'sess-1', status: 'approved' }
            })
        }) as unknown as Promise<Response>
      }
      if (url.includes('/api/party/ABC123/playlist')) {
        playlistFetchCount += 1
        if (playlistFetchCount >= 2) {
          return Promise.resolve({
            ok: false,
            status: 403,
            json: () => Promise.resolve({ error: 'not_available' })
          }) as unknown as Promise<Response>
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              playlist: [
                {
                  playlistItemId: 'p1',
                  position: 0,
                  title: 'Song One',
                  status: 'queued',
                  requestedByGuestId: 'guest-1',
                  requestedByGuestDisplayName: 'Alice'
                },
                { playlistItemId: 'p2', position: 1, title: 'Song Two', status: 'queued' }
              ]
            })
        }) as unknown as Promise<Response>
      }
      if (url.includes('/api/party/ABC123/leave')) {
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
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows Stage is open plus queued songs when no active song', async () => {
    render(
      <MemoryRouter initialEntries={['/party/ABC123']}>
        <Routes>
          <Route path="/party/:partyCode" element={<PartyLobbyPage />} />
          <Route path="/" element={<p>Home screen</p>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Stage is open/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/There is no song on the main screen yet\./i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Queued songs/i })).toBeInTheDocument()
    expect(screen.getByText(/Song One/i)).toBeInTheDocument()
    expect(screen.getByText(/Song Two/i)).toBeInTheDocument()
    expect(screen.getByText(/Requested by Alice/i)).toBeInTheDocument()
  })

  it('shows no-lyrics message when active song has no lyric lines', async () => {
    render(
      <MemoryRouter initialEntries={['/party/ABC123']}>
        <Routes>
          <Route path="/party/:partyCode" element={<PartyLobbyPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Stage is open/i)).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(socketHandlers.has('party:state')).toBe(true)
    })

    act(() => {
      socketHandlers.get('party:state')?.({
        sessionStatus: 'active',
        playbackStatus: 'playing',
        activeSong: { id: 'song-1', title: 'Song One' },
        lyricLines: [],
        currentLine: null
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/No lyrics available for this song\./i)).toBeInTheDocument()
    })
  })

  it('playlist:updated with ended session closes lobby via playlist 403', async () => {
    render(
      <MemoryRouter initialEntries={['/party/ABC123']}>
        <Routes>
          <Route path="/party/:partyCode" element={<PartyLobbyPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Song One/i)).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(socketHandlers.has('playlist:updated')).toBe(true)
    })

    await act(async () => {
      await socketHandlers.get('playlist:updated')?.({})
    })

    await waitFor(() => {
      expect(screen.getByText(/This party has ended/i)).toBeInTheDocument()
    })
  })

  it('leave party redirects guest to homepage', async () => {
    render(
      <MemoryRouter initialEntries={['/party/ABC123']}>
        <Routes>
          <Route path="/party/:partyCode" element={<PartyLobbyPage />} />
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
})
