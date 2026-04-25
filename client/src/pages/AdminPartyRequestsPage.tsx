import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type Pending = {
  id: string
  partyName: string
  eventDatetime: string | null
  expectedGuests: number | null
  description: string | null
  hostEmail: string
  hostDisplayName: string
}

export function AdminPartyRequestsPage() {
  const [rows, setRows] = useState<Pending[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [rejectFor, setRejectFor] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  async function load() {
    setErr(null)
    try {
      const r = await fetch('/api/admin/party-requests', { credentials: 'include' })
      const d = (await r.json()) as { partyRequests?: Pending[] }
      if (!r.ok) {
        setErr('load_failed')
        return
      }
      setRows(d.partyRequests ?? [])
    } catch {
      setErr('network')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function approve(id: string) {
    setErr(null)
    try {
      const r = await fetch(`/api/admin/party-requests/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      if (r.status === 409) {
        setErr('already_handled')
        return
      }
      if (!r.ok) {
        setErr('approve_failed')
        return
      }
      await load()
    } catch {
      setErr('network')
    }
  }

  async function reject(e: FormEvent) {
    e.preventDefault()
    if (!rejectFor) return
    setErr(null)
    try {
      const r = await fetch(`/api/admin/party-requests/${rejectFor}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() })
      })
      if (!r.ok) {
        setErr('reject_failed')
        return
      }
      setRejectFor(null)
      setRejectReason('')
      await load()
    } catch {
      setErr('network')
    }
  }

  function formatWhen(iso: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  }

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-black text-white">Pending party requests</h2>
        <Link
          to="/admin"
          className="text-sm font-bold text-amber-200 hover:text-amber-100"
        >
          Admin home
        </Link>
      </div>
      {err && (
        <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {err}
        </p>
      )}
      {rows && rows.length === 0 && !err && (
        <p className="text-sm text-white/80">No pending requests.</p>
      )}
      {rows && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((p) => (
            <li
              key={p.id}
              className="fs-card-lobby border border-amber-200/30 p-4 text-sm text-white/90"
            >
              <div className="font-bold text-amber-100">{p.partyName}</div>
              <p className="mt-1 text-white/80">
                Host: {p.hostDisplayName} &lt;{p.hostEmail}&gt;
                <br />
                {formatWhen(p.eventDatetime)} · {p.expectedGuests ?? '—'} guests
              </p>
              {p.description ? <p className="mt-2 whitespace-pre-wrap">{p.description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-2xl bg-lime-400 px-4 py-2 text-sm font-black text-slate-900"
                  onClick={() => void approve(p.id)}
                >
                  Approve
                </button>
                {rejectFor === p.id ? (
                  <form className="flex flex-wrap items-end gap-2" onSubmit={reject}>
                    <input
                      className="min-w-[12rem] rounded-2xl border-2 border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Rejection reason"
                      required
                    />
                    <button
                      type="submit"
                      className="rounded-2xl border border-rose-300/50 bg-rose-500/20 px-3 py-2 text-sm font-bold text-rose-100"
                    >
                      Confirm reject
                    </button>
                    <button
                      type="button"
                      className="text-sm text-white/60"
                      onClick={() => {
                        setRejectFor(null)
                        setRejectReason('')
                      }}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="rounded-2xl border border-rose-300/50 bg-rose-500/20 px-4 py-2 text-sm font-bold text-rose-100"
                    onClick={() => {
                      setRejectFor(p.id)
                      setRejectReason('')
                    }}
                  >
                    Reject
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
