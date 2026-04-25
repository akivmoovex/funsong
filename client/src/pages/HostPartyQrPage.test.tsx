import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HostPartyQrPage } from './HostPartyQrPage'

const partyRequestUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const samplePartyCode = 'ZetaCode-99'

function renderQr() {
  return render(
    <MemoryRouter initialEntries={[`/host/parties/${partyRequestUuid}/qr`]}>
      <Routes>
        <Route path="/host/parties/:partyId/qr" element={<HostPartyQrPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('HostPartyQrPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('displays party_code from API, not a database UUID in the code field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          partyCode: samplePartyCode,
          joinPath: `/join/${encodeURIComponent(samplePartyCode)}`,
          joinUrl: `https://example.com/join/${encodeURIComponent(samplePartyCode)}`
        })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    renderQr()

    await waitFor(() => {
      expect(screen.getAllByTestId('qr-party-code-value')[0]).toHaveTextContent(samplePartyCode)
    })

    const value = screen.getAllByTestId('qr-party-code-value')[0].textContent?.trim() ?? ''
    const looksLikeRequestUuid = /^[0-9a-f-]{8}-[0-9a-f-]{4}-/i.test(value) && value.length > 20
    expect(looksLikeRequestUuid).toBe(false)

    expect(screen.getByText('Party Code:', { exact: false })).toBeInTheDocument()
    const img = screen.getByTestId('qr-png-image')
    expect(img.getAttribute('src')).toContain(
      `/api/host/parties/${encodeURIComponent(partyRequestUuid)}/qr`
    )
  })

  it('does not render a broken QR image when party code JSON is unavailable', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'not_found' })
    }) as unknown as typeof fetch

    renderQr()

    await waitFor(() => {
      expect(
        screen.getByText(
          'The party code is not available yet. The party may still be preparing — refresh in a moment, or check party details.'
        )
      ).toBeInTheDocument()
    })
    expect(screen.queryByTestId('qr-png-image')).toBeNull()
  })

  it('shows join link when provided', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            partyCode: samplePartyCode,
            joinPath: `/join/${encodeURIComponent(samplePartyCode)}`,
            joinUrl: 'https://app.example.com/join/ZetaCode-99'
          })
      }) as unknown as typeof fetch

    renderQr()

    await waitFor(() => {
      const link = screen.getAllByTestId('qr-join-link')[0]
      expect(link).toHaveAttribute('href', 'https://app.example.com/join/ZetaCode-99')
    })
  })

  it('copy code writes party_code to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const nav = { ...globalThis.navigator, clipboard: { writeText } }
    vi.stubGlobal('navigator', nav as Navigator)

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            partyCode: samplePartyCode,
            joinPath: `/join/${encodeURIComponent(samplePartyCode)}`,
            joinUrl: 'https://example.com/join/x'
          })
      }) as unknown as typeof fetch

    renderQr()

    await waitFor(() => {
      expect(screen.getAllByTestId('qr-copy-party-code').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByTestId('qr-copy-party-code')[0])
    expect(writeText).toHaveBeenCalledWith(samplePartyCode)
  })
})
