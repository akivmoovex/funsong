import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BusyOverlayProvider, useDelayedBusy } from './BusyOverlayProvider'

function ShortWorkButton() {
  const { runBusy } = useDelayedBusy()
  return (
    <button
      type="button"
      onClick={() => void runBusy(() => Promise.resolve('ok'), { message: 'Fast' })}
    >
      short
    </button>
  )
}

function TimedWorkButton() {
  const { runBusy } = useDelayedBusy()
  return (
    <button
      type="button"
      onClick={() =>
        void runBusy(
          () =>
            new Promise<string>((r) => {
              setTimeout(() => {
                r('done')
              }, 1500)
            }),
          { message: 'Please wait' }
        )
      }
    >
      timed
    </button>
  )
}

describe('useDelayedBusy / BusyOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('does not show overlay before 1 second', () => {
    render(
      <BusyOverlayProvider>
        <TimedWorkButton />
      </BusyOverlayProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'timed' }))
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.queryByTestId('delayed-busy-overlay')).not.toBeInTheDocument()
  })

  it('shows overlay after 1 second while work is in flight', () => {
    render(
      <BusyOverlayProvider>
        <TimedWorkButton />
      </BusyOverlayProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'timed' }))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByTestId('delayed-busy-overlay')).toBeInTheDocument()
    expect(screen.getByText(/Please wait/)).toBeInTheDocument()
  })

  it('hides overlay when work finishes', async () => {
    render(
      <BusyOverlayProvider>
        <TimedWorkButton />
      </BusyOverlayProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'timed' }))
    // t=0: 1s overlay delay + 1.5s work delay both scheduled
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByTestId('delayed-busy-overlay')).toBeInTheDocument()
    // t=1000 → t=1500: work Promise resolves, runBusy finally clears overlay
    act(() => {
      vi.advanceTimersByTime(500)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByTestId('delayed-busy-overlay')).not.toBeInTheDocument()
  })

  it('does not show overlay for work finishing before 1 second', async () => {
    render(
      <BusyOverlayProvider>
        <ShortWorkButton />
      </BusyOverlayProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'short' }))
    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.queryByTestId('delayed-busy-overlay')).not.toBeInTheDocument()
  })
})
