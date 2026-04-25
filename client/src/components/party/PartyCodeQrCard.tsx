import { useMemo } from 'react'
import QRCode from 'react-qr-code'

type Props = {
  partyCode: string
  className?: string
}

/**
 * Guest-facing “share the room” card: big code + QR to the join URL.
 */
export function PartyCodeQrCard({ partyCode, className }: Props) {
  const joinUrl = useMemo(
    () =>
      typeof window !== 'undefined'
        ? `${window.location.origin}/join/${encodeURIComponent(partyCode)}`
        : `https://funsong.app/join/${encodeURIComponent(partyCode)}`,
    [partyCode]
  )

  return (
    <div
      className={`fs-card-lobby overflow-hidden rounded-3xl border-2 border-white/30 bg-gradient-to-br from-cyan-400/30 via-fuchsia-500/20 to-amber-300/25 p-4 shadow-2xl sm:p-5 ${className ?? ''}`}
    >
      <p className="text-center text-xs font-extrabold uppercase tracking-widest text-white/80">Scan to join</p>
      <div className="mt-3 flex justify-center rounded-2xl bg-white p-3 shadow-inner">
        <QRCode value={joinUrl} size={128} level="M" className="h-32 w-32 max-w-full" />
      </div>
      <p className="mt-3 text-center text-xs text-white/70">or open with code</p>
      <p
        className="mt-1 break-all text-center font-mono text-2xl font-black tracking-tight text-white drop-shadow sm:text-3xl"
        aria-label={`Party code ${partyCode}`}
      >
        {partyCode}
      </p>
    </div>
  )
}
