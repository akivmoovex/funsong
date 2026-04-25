import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  cleanup()
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

  it('renders authenticated burger menu for signed-in host with expected order and logout last', async () => {
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
      if (url.includes('/api/auth/logout')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true })
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
        initialEntries={['/host/dashboard']}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open user menu/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    const menu = await screen.findByTestId('auth-burger-menu')
    expect(within(menu).getByText('host@example.com')).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /My Songs/i })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /Host Dashboard/i })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /Create Party/i })).toBeInTheDocument()

    const ordered = Array.from(menu.querySelectorAll('a,button')).map((el) =>
      (el.textContent || '').trim()
    )
    expect(ordered[0]).toContain('Host')
    expect(ordered[1]).toBe('My Songs')
    expect(ordered[ordered.length - 1]).toBe('Logout')
  })

  it('renders super admin burger menu with admin role-specific items', async () => {
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
      expect(screen.getByRole('button', { name: /open user menu/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    const menu = await screen.findByTestId('auth-burger-menu')
    expect(within(menu).getByRole('link', { name: /Admin Dashboard/i })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /^Songs$/i })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /Parties/i })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /Settings/i })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /Password resets/i })).toBeInTheDocument()
  })

  it('logout from authenticated burger menu redirects to homepage', async () => {
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
      if (url.includes('/api/auth/logout')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true })
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
        initialEntries={['/host/dashboard']}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open user menu/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(await screen.findByTestId('auth-menu-logout'))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Party mode:/i })).toBeInTheDocument()
    })
  })

  it('does not show authenticated burger menu when signed out', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ user: null })
      })
    ) as unknown as typeof fetch

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={['/']}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Party mode:/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /open user menu/i })).not.toBeInTheDocument()
  })

  it('loads My Songs practice route with reused karaoke player', async () => {
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
      if (url.includes('/api/account/my-songs/11111111-1111-4111-8111-111111111111/practice')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              song: {
                id: '11111111-1111-4111-8111-111111111111',
                title: 'Fav Song',
                audioFileUrl: '/api/songs/11111111-1111-4111-8111-111111111111/audio'
              },
              lines: [
                { lineNumber: 0, textEnglish: 'Hello line' },
                { lineNumber: 1, textEnglish: 'Second line' }
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
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={['/my-songs/practice/11111111-1111-4111-8111-111111111111']}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Practice mode/i)).toBeInTheDocument()
    })
    expect(screen.getByTestId('karaoke-audio-block')).toBeInTheDocument()
    expect(screen.getByTestId('practice-lyrics-panel')).toBeInTheDocument()
  })
})
