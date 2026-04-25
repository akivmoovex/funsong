import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type ResetReq = {
  id: string
  email: string
  userId: string | null
  userEmail: string | null
  userDisplayName: string | null
  status: string
  requestedAt: string
}

export function AdminPasswordResetRequestsPage() {
  const [rows, setRows] = useState<ResetReq[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    void (async () => {
      try {
        const r = await fetch('/api/admin/password-reset-requests', { credentials: 'include' })
        const d = (await r.json().catch(() => ({}))) as { requests?: ResetReq[]; error?: string }
        if (!r.ok) {
          if (!cancel) setErr(d.error || 'load_failed')
          return
        }
        if (!cancel) setRows(d.requests ?? [])
      } catch {
        if (!cancel) setErr('network')
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-black text-white">Password reset requests</h2>
          <p className="mt-1 text-sm text-white/75">
            Manual reset queue for V1 (no email provider configured yet).
          </p>
        </div>
        <Link to="/admin" className="font-bold text-amber-200 hover:text-amber-100">
          Admin home
        </Link>
      </div>
      {err && (
        <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          Could not load requests ({err}).
        </p>
      )}
      {rows && rows.length === 0 && !err && (
        <p className="text-sm text-white/80">No pending reset requests.</p>
      )}
      {rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm">
              <div className="font-bold text-white">{r.email}</div>
              <div className="text-xs text-white/70">
                {r.userDisplayName ? `${r.userDisplayName} · ` : ''}
                {r.userEmail || 'Unknown user mapping'}
              </div>
              <div className="mt-1 text-xs text-white/50">
                Requested: {new Date(r.requestedAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
