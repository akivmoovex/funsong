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

  it('loads admin dashboard with monitoring-first actions', async () => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              user: {
                id: '1',
                email: 'admin@example.com',
                displayName: 'Admin',
                role: 'super_admin',
                isActive: true
              }
            })
        }) as unknown as Promise<Response>
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      }) as unknown as Promise<Response>
    }) as unknown as typeof fetch

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={['/admin']}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Admin dashboard/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /Open party monitor/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open settings/i })).toBeInTheDocument()
  })

  it('shows host waiting page for pending approval', async () => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              user: {
                id: 'host-1',
                email: 'host@example.com',
                displayName: 'Host',
                role: 'host',
                isActive: true
              }
            })
        }) as unknown as Promise<Response>
      }
      if (url.includes('/api/host/party-requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/status')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              request: {
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                status: 'pending',
                partyName: 'My Party',
                eventDatetime: '2030-01-01T12:00:00.000Z',
                location: 'Tel Aviv'
              }
            })
        }) as unknown as Promise<Response>
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      }) as unknown as Promise<Response>
    }) as unknown as typeof fetch

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={['/host/party-requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/waiting']}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Waiting for admin approval/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Checking again in/i)).toBeInTheDocument()
  })
})
