import { useEffect, useState } from 'react'

const DEFAULT_MSG = 'Working on it...'

type Props = {
  message: string
}

/**
 * Full-screen dimmed overlay. Decorative animation is `aria-hidden`; the live message is
 * read via `role="status"` (no focus trap).
 */
export function BusyOverlayView({ message }: Props) {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const text = message.trim() || DEFAULT_MSG

  return (
    <div
      data-testid="delayed-busy-overlay"
      className="pointer-events-auto fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/75 px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {reducedMotion ? (
        <div className="text-5xl text-amber-200/95 animate-pulse" aria-hidden>
          ♪
        </div>
      ) : (
        <div
          className="fs-busy-notes-clip relative h-12 w-56 overflow-hidden text-center text-3xl sm:w-72"
          aria-hidden
        >
          <div className="fs-busy-notes-track text-amber-200/90">
            <span className="fs-busy-note">♩</span>
            <span className="fs-busy-note">♪</span>
            <span className="fs-busy-note">♫</span>
            <span className="fs-busy-note">♬</span>
            <span className="fs-busy-note">♩</span>
            <span className="fs-busy-note">♪</span>
            <span className="fs-busy-note">♫</span>
          </div>
        </div>
      )}
      <p className="mt-5 text-center text-sm font-extrabold text-white drop-shadow">{text}</p>
    </div>
  )
}
