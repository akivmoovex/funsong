import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../AuthContext'
import { BusyOverlayProvider } from '../components/busy/BusyOverlayProvider'
import { LoginPage } from './LoginPage'

beforeEach(() => {
  window.sessionStorage.clear()
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/auth/me')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ user: null })
      }) as unknown as Promise<Response>
    }
    if (url.includes('/api/auth/login')) {
      return Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'invalid_credentials' })
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

function renderLogin() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <BusyOverlayProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<div>Forgot password page</div>} />
          </Routes>
        </BusyOverlayProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

async function submitBadLogin() {
  fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'host@example.com' } })
  fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'wrongpass' } })
  fireEvent.click(screen.getByRole('button', { name: /log in/i }))
  await waitFor(() => {
    expect(screen.getByText(/Check your email and password/i)).toBeInTheDocument()
  })
}

describe('LoginPage forgot-password visibility', () => {
  it('keeps forgot-password link hidden before 3 failed attempts', async () => {
    renderLogin()
    await submitBadLogin()
    await submitBadLogin()
    expect(screen.queryByRole('link', { name: /Request reset help/i })).not.toBeInTheDocument()
  })

  it('shows forgot-password link after 3 failed attempts', async () => {
    renderLogin()
    await submitBadLogin()
    await submitBadLogin()
    await submitBadLogin()
    expect(screen.getByRole('link', { name: /Request reset help/i })).toBeInTheDocument()
  })
})
