import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManualPartyCodeJoinForm } from './ManualPartyCodeJoinForm'

const mockNav = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return { ...mod, useNavigate: () => mockNav }
})

afterEach(() => {
  cleanup()
})

describe('ManualPartyCodeJoinForm', () => {
  it('renders enter code label and join button', () => {
    render(
      <MemoryRouter>
        <ManualPartyCodeJoinForm idPrefix="join" />
      </MemoryRouter>
    )
    const form = screen.getAllByTestId('join-manual-join-form')[0]
    expect(form).toBeInTheDocument()
    expect(within(form).getByLabelText(/Enter party code/i)).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: /Join Party/i })).toBeInTheDocument()
  })

  it('validates empty submit', () => {
    render(
      <MemoryRouter>
        <ManualPartyCodeJoinForm idPrefix="join" />
      </MemoryRouter>
    )
    const form = screen.getAllByTestId('join-manual-join-form')[0]
    fireEvent.click(within(form).getByRole('button', { name: /Join Party/i }))
    expect(within(form).getByText(/Enter a party code first\./i)).toBeInTheDocument()
  })

  it('redirects to /join/:partyCode with normalized code', async () => {
    mockNav.mockReset()
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<ManualPartyCodeJoinForm idPrefix="j" />} />
        </Routes>
      </MemoryRouter>
    )
    const form = screen.getAllByTestId('j-manual-join-form')[0]
    const input = screen.getAllByTestId('j-party-code-input')[0]
    fireEvent.change(input, { target: { value: '  Xy9Code01  ' } })
    fireEvent.click(within(form).getByRole('button', { name: /Join Party/i }))
    await waitFor(() => {
      expect(mockNav).toHaveBeenCalledWith('/join/Xy9Code01')
    })
  })
})
