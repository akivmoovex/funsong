import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HostPage } from './HostPage'

beforeEach(() => {
  window.sessionStorage.clear()
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ partyRequests: [] })
  }) as unknown as typeof fetch
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('HostPage signup success popup', () => {
  it('shows popup when signup success flag is present', async () => {
    render(
      <MemoryRouter initialEntries={['/host/dashboard?signup=success']}>
        <Routes>
          <Route path="/host/dashboard" element={<HostPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /signup successful dialog/i })).toBeInTheDocument()
    })
    expect(screen.getByText(/Signup successful!/i)).toBeInTheDocument()
    expect(screen.getByText(/Welcome to FunSong/i)).toBeInTheDocument()
  })

  it('auto closes popup after 5 seconds', async () => {
    vi.useFakeTimers()
    render(
      <MemoryRouter initialEntries={['/host/dashboard?signup=success']}>
        <Routes>
          <Route path="/host/dashboard" element={<HostPage />} />
        </Routes>
      </MemoryRouter>
    )
    await Promise.resolve()
    expect(screen.getByRole('dialog', { name: /signup successful dialog/i })).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(5000)
    expect(screen.queryByRole('dialog', { name: /signup successful dialog/i })).not.toBeInTheDocument()
  })
})
