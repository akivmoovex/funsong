import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PartyLobbyPage } from './PartyLobbyPage'

vi.mock('../realtime/partySocket', () => ({
  createPartySocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
    close: vi.fn()
  })
}))

describe('PartyLobbyPage queue visibility', () => {
  beforeEach(() => {
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
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              playlist: [
                { playlistItemId: 'p1', position: 0, title: 'Song One', status: 'queued' },
                { playlistItemId: 'p2', position: 1, title: 'Song Two', status: 'queued' }
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

  it('shows Stage is open plus queued songs when no active song', async () => {
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
    expect(screen.getByText(/There is no song on the main screen yet\./i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Queued songs/i })).toBeInTheDocument()
    expect(screen.getByText(/Song One/i)).toBeInTheDocument()
    expect(screen.getByText(/Song Two/i)).toBeInTheDocument()
  })
})
