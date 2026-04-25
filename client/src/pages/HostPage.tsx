import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

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
  const nav = useNavigate()
  const [search, setSearch] = useSearchParams()
  const [rows, setRows] = useState<PartyRequestRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showSignupSuccess, setShowSignupSuccess] = useState(false)

  useEffect(() => {
    const flag = search.get('signup')
    if (flag !== 'success') return
    const key = 'funsong.signup.success.seen'
    if (window.sessionStorage.getItem(key) !== '1') {
      window.sessionStorage.setItem(key, '1')
      setShowSignupSuccess(true)
    }
    const next = new URLSearchParams(search)
    next.delete('signup')
    setSearch(next, { replace: true })
  }, [search, setSearch])

  useEffect(() => {
    if (!showSignupSuccess) return
    const t = window.setTimeout(() => {
      setShowSignupSuccess(false)
    }, 5000)
    return () => window.clearTimeout(t)
  }, [showSignupSuccess])

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
      {showSignupSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4" role="dialog" aria-modal="true" aria-label="Signup successful dialog">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-emerald-300/40 bg-slate-900/95 p-6 shadow-2xl">
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <rect
                x="1"
                y="1"
                width="98"
                height="98"
                rx="8"
                ry="8"
                className="fs-signup-success-border"
              />
            </svg>
            <button
              type="button"
              onClick={() => {
                setShowSignupSuccess(false)
                nav('/host/dashboard', { replace: true })
              }}
              className="absolute right-3 top-3 rounded-full bg-white/10 px-2 py-1 text-xs font-extrabold text-white/85 hover:bg-white/20"
              aria-label="Close signup success popup"
            >
              ✕
            </button>
            <p className="text-sm font-extrabold uppercase tracking-widest text-emerald-200">Signup successful!</p>
            <h3 className="mt-2 text-2xl font-black text-white">Welcome to FunSong.</h3>
            <p className="mt-2 text-sm text-white/80">
              Your host account is ready. This message closes in 5 seconds.
            </p>
          </div>
        </div>
      )}
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
