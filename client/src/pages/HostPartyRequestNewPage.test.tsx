import '@testing-library/jest-dom/vitest'
import { render, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BusyOverlayProvider } from '../components/busy/BusyOverlayProvider'
import { HostPartyRequestNewPage } from './HostPartyRequestNewPage'

const CONSENT_LABEL =
  'I confirm this is a private friends and family event only with less than 30 guests. No commercial use or recording will be allowed. I understand that FunSong is a tool to help connect people via music. FunSong does not claim ownership of original songs.'

function renderPage() {
  return render(
    <MemoryRouter>
      <BusyOverlayProvider>
        <HostPartyRequestNewPage />
      </BusyOverlayProvider>
    </MemoryRouter>
  )
}

describe('HostPartyRequestNewPage', () => {
  it('does not show event date/time field', () => {
    const { container } = renderPage()
    expect(container.querySelector('input[type="datetime-local"]')).toBeNull()
  })

  it('shows consent text only on the required checkbox (single copy in the form)', () => {
    const { container } = renderPage()
    const form = container.querySelector('form')
    expect(form).toBeInstanceOf(HTMLFormElement)
    if (!(form instanceof HTMLFormElement)) throw new Error('expected form')
    expect(within(form).getByText(CONSENT_LABEL, { exact: true })).toBeInTheDocument()
    expect(
      within(form).getByRole('checkbox', {
        name: CONSENT_LABEL
      })
    ).toBeInTheDocument()
  })
})
