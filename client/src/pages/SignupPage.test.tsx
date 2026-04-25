import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SignupPage } from './SignupPage'

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({})
  }) as unknown as typeof fetch
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SignupPage', () => {
  it('successful signup redirects to host dashboard with success flag', async () => {
    render(
      <MemoryRouter initialEntries={['/signup']}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/host/dashboard" element={<div>Host Dashboard Loaded</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Host One' } })
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'host@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'goodpass123' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'goodpass123' } })
    fireEvent.click(screen.getByRole('button', { name: /Create host account/i }))

    await waitFor(() => {
      expect(screen.getByText('Host Dashboard Loaded')).toBeInTheDocument()
    })
  })

  it('failed signup does not navigate and shows error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'email_taken' })
    }) as unknown as typeof fetch

    render(
      <MemoryRouter initialEntries={['/signup']}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/host/dashboard" element={<div>Host Dashboard Loaded</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Host One' } })
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'host@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'goodpass123' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'goodpass123' } })
    fireEvent.click(screen.getByRole('button', { name: /Create host account/i }))

    await waitFor(() => {
      expect(screen.getByText(/already registered/i)).toBeInTheDocument()
    })
    expect(screen.queryByText('Host Dashboard Loaded')).not.toBeInTheDocument()
  })
})
