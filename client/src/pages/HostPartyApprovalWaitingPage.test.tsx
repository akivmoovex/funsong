import '@testing-library/jest-dom/vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HostPartyApprovalWaitingPage } from './HostPartyApprovalWaitingPage'

const mockNav = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNav
  }
})

describe('HostPartyApprovalWaitingPage', () => {
  beforeEach(() => {
    mockNav.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects to backend-provided path when request is rejected', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          request: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            status: 'rejected',
            partyName: 'My Party',
            eventDatetime: '2030-01-01T12:00:00.000Z',
            rejectionReason: 'Invalid details',
            redirectPath: '/host/parties/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
          }
        })
    }) as unknown as typeof fetch

    render(
      <MemoryRouter initialEntries={['/host/party-requests/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/waiting']}>
        <Routes>
          <Route
            path="/host/party-requests/:partyId/waiting"
            element={<HostPartyApprovalWaitingPage />}
          />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockNav).toHaveBeenCalledWith('/host/parties/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
        replace: true
      })
    })
  })
})
