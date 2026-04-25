import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { AuthProvider } from './AuthContext'

beforeEach(() => {
  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ user: null })
    })
  ) as unknown as typeof fetch
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App', () => {
  it('has no public song index route: /songs shows the not-found message', async () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={['/songs']}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Not found/i })).toBeInTheDocument()
    })
    expect(
      screen.getByText(/no public music or lyrics directory/i)
    ).toBeInTheDocument()
  })

  it('renders the home experience', async () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Party mode:/i })
      ).toBeInTheDocument()
    })
    expect(screen.getByText(/Host a party/i)).toBeInTheDocument()
  })
})
