import { useEffect, type CSSProperties } from 'react'

const COLORS = [
  'bg-fuchsia-400',
  'bg-amber-300',
  'bg-cyan-300',
  'bg-lime-300',
  'bg-rose-400',
  'bg-violet-400'
]

type Props = {
  show: boolean
  onComplete?: () => void
}

/**
 * Lightweight full-screen confetti: small divs + CSS animation (no canvas dependency).
 */
export function SongFinishedConfetti({ show, onComplete }: Props) {
  useEffect(() => {
    if (!show) {
      return
    }
    const t = window.setTimeout(() => {
      onComplete?.()
    }, 2800)
    return () => {
      window.clearTimeout(t)
    }
  }, [show, onComplete])

  if (!show) {
    return null
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      aria-hidden
      role="presentation"
      data-testid="song-finished-confetti"
    >
      {Array.from({ length: 28 }, (_, i) => {
        const color = COLORS[i % COLORS.length]
        const left = (i * 3.2 + (i % 5)) % 100
        const delay = (i * 0.04) % 0.6
        const w = 6 + (i % 4) * 2
        const style: CSSProperties = {
          left: `${left}%`,
          width: w,
          height: Math.max(8, w * 1.2),
          animationDelay: `${delay}s`,
          ['--fs-dx' as string]: `${(i % 7) * 8 - 24}px`
        }
        return (
          <span
            key={i}
            className={`fs-animate-confetti absolute top-0 rounded-sm ${color} opacity-90 shadow-sm`}
            style={style}
          />
        )
      })}
    </div>
  )
}
