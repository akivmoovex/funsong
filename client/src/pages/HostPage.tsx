import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type PartyRequestRow = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  partyName: string
  eventDatetime: string | null
  expectedGuests: number | null
  canShowQr?: boolean
  canShowJoinLink?: boolean
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
          Create a new party
        </Link>
      </div>
      <p className="text-sm text-white/80">
        Your parties appear here. New parties are ready with join link and QR as soon as you create them.
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
              <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm transition hover:border-fuchsia-400/50 hover:bg-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/host/parties/${p.id}`} className="font-bold text-white hover:text-fuchsia-100">
                    {p.partyName}
                  </Link>
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
                </div>
                <p className="text-white/70">
                  {formatWhen(p.eventDatetime)} · {p.expectedGuests ?? '—'} guests
                </p>
                {p.status === 'approved' && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Link to={`/host/parties/${p.id}`} className="text-xs font-bold text-cyan-200 underline">
                      Open party
                    </Link>
                    {p.canShowQr && (
                      <Link
                        to={`/host/parties/${p.id}/qr`}
                        className="text-xs font-bold text-emerald-200 underline"
                      >
                        Open QR
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
