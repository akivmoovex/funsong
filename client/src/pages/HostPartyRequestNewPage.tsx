import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function HostPartyRequestNewPage() {
  const nav = useNavigate()
  const [partyName, setPartyName] = useState('')
  const [eventDatetime, setEventDatetime] = useState('')
  const [location, setLocation] = useState('')
  const [privateUseOk, setPrivateUseOk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const r = await fetch('/api/host/parties/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyName: partyName.trim(),
          eventDatetime: new Date(eventDatetime).toISOString(),
          location: location.trim(),
          privateUseConfirmed: true
        })
      })
      const d = (await r.json().catch(() => ({}))) as { partyRequest?: { id: string }; error?: string }
      if (!r.ok) {
        setError(d.error || 'request_failed')
        return
      }
      if (d.partyRequest?.id) {
        nav(`/host/parties/${d.partyRequest.id}`)
        return
      }
      setError('invalid_response')
    } catch {
      setError('network')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fs-card max-w-lg space-y-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-black">Create a party</h2>
        <Link
          to="/host/dashboard"
          className="text-sm font-bold text-fuchsia-300 hover:text-fuchsia-200"
        >
          Back to dashboard
        </Link>
      </div>
      <p className="text-sm text-white/80">
        Fill in the details below and generate your join QR instantly.
      </p>
      <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-50/95">
        I confirm this is a private friends and family event only with less than 30 guests.
        No commercial use or recording will be allowed. I understand that FunSong is a tool
        to help connect people via music. FunSong does not claim ownership of original songs.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/60">
            Party name
          </label>
          <input
            required
            className="w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-white/40"
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            placeholder="e.g. Sarah’s birthday"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/60">
            Event date & time
          </label>
          <input
            required
            type="datetime-local"
            className="w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none ring-0"
            value={eventDatetime}
            onChange={(e) => setEventDatetime(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/60">
            Location
          </label>
          <input
            required
            className="w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none ring-0"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Tel Aviv, home living room"
            autoComplete="off"
          />
        </div>
        <div className="flex gap-2 rounded-2xl border border-white/15 bg-white/5 p-3">
          <input
            id="fs-private-use-confirm"
            type="checkbox"
            checked={privateUseOk}
            onChange={(e) => setPrivateUseOk(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <label htmlFor="fs-private-use-confirm" className="text-sm text-white/90">
            I confirm this is a private friends and family event only with less than 30 guests.
            No commercial use or recording will be allowed. I understand that FunSong is a tool
            to help connect people via music. FunSong does not claim ownership of original songs.
          </label>
        </div>
        {error && (
          <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            Something went wrong ({error}).
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !privateUseOk}
          className="w-full rounded-2xl bg-fuchsia-500 py-3 text-sm font-black text-white shadow-lg shadow-fuchsia-500/30 hover:bg-fuchsia-400 disabled:opacity-60"
        >
          {busy ? 'Creating…' : 'Create Party and Generate QR'}
        </button>
      </form>
    </div>
  )
}
