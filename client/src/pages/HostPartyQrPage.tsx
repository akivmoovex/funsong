import { Link, useParams } from 'react-router-dom'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function HostPartyQrPage() {
  const { partyId } = useParams()
  if (!partyId || !UUID_RE.test(partyId)) {
    return (
      <div className="fs-card text-left text-sm text-white/80">Invalid party id.</div>
    )
  }

  const src = `/api/host/parties/${encodeURIComponent(partyId)}/qr`

  return (
    <div className="fs-card max-w-md space-y-4 text-center text-left sm:text-left">
      <h2 className="text-2xl font-black">Party QR</h2>
      <p className="text-sm text-white/80">
        Guests open this code on their phone. It does not use your account id; it
        only contains the public join path.
      </p>
      <div className="mx-auto w-fit rounded-2xl border border-white/10 bg-white p-4 sm:mx-0">
        <img
          src={src}
          alt="QR code to join the party"
          className="h-64 w-64 object-contain"
        />
      </div>
      <p className="text-xs text-white/50">
        If the code does not show, the party may still be preparing. Refresh in a moment.
      </p>
      <Link
        to={`/host/parties/${partyId}`}
        className="inline-block font-bold text-fuchsia-300 hover:text-fuchsia-200"
      >
        Back to party details
      </Link>
    </div>
  )
}
