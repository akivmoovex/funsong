import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type PartyRequestRow = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  partyName: string
  eventDatetime: string | null
  expectedGuests: number | null
}

function labelForStatus(s: PartyRequestRow['status']) {
  if (s === 'pending') return 'Pending'
  if (s === 'approved') return 'Approved'
  return 'Rejected'
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function HostPage() {
  const [rows, setRows] = useState<PartyRequestRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    void (async () => {
      try {
        const r = await fetch('/api/host/party-requests', { credentials: 'include' })
        const d = (await r.json()) as { partyRequests?: PartyRequestRow[]; error?: string }
        if (!r.ok) {
          if (!cancel) setErr(d.error || 'load_failed')
          return
        }
        if (!cancel) {
          setRows(d.partyRequests ?? [])
          setErr(null)
        }
      } catch {
        if (!cancel) setErr('network')
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  return (
    <div className="fs-card space-y-4 text-left">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-2xl font-black">Host dashboard</h2>
        <Link
          to="/host/parties/new"
          className="rounded-2xl bg-fuchsia-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30 hover:bg-fuchsia-400"
        >
          Request a new party
        </Link>
      </div>
      <p className="text-sm text-white/80">
        Your party requests appear here. After an admin approves a request, you
        will get a shareable join link and QR on the party page.
      </p>
      {err && (
        <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          Could not load party requests ({err}).
        </p>
      )}
      {rows && rows.length === 0 && !err && (
        <div className="rounded-2xl border border-dashed border-white/30 bg-slate-900/20 p-4 text-sm text-white/90">
          No party requests yet. Create one to get started.
        </div>
      )}
      {rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.id}>
              <Link
                to={`/host/parties/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm transition hover:border-fuchsia-400/50 hover:bg-white/10"
              >
                <span className="font-bold text-white">{p.partyName}</span>
                <span className="text-white/70">
                  {formatWhen(p.eventDatetime)} · {p.expectedGuests ?? '—'} guests
                </span>
                <span
                  className={
                    p.status === 'approved'
                      ? 'text-emerald-300'
                      : p.status === 'rejected'
                        ? 'text-rose-200'
                        : 'text-amber-200'
                  }
                >
                  {labelForStatus(p.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
