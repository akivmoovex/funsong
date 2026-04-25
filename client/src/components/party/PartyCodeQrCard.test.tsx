import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PartyCodeQrCard } from './PartyCodeQrCard'

describe('PartyCodeQrCard', () => {
  it('renders party code and join prompt', () => {
    render(<PartyCodeQrCard partyCode="ABC123" />)
    expect(screen.getByText(/scan to join/i)).toBeTruthy()
    expect(screen.getByLabelText(/party code ABC123/i)).toBeTruthy()
  })
})
