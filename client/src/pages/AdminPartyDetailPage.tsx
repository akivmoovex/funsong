import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Party = {
  id: string
  partyName: string
  hostEmail: string
  hostDisplayName: string
  status: string
  endedAt?: string | null
  maxGuests: number
  partyCode: string | null
  requestStatus: string
  createdAt: string
  connectedGuestCount: number
  activeSong: { id: string; title: string } | null
  currentController: { id: string; displayName: string } | null
}

export function AdminPartyDetailPage() {
  const { partyId } = useParams()
  const [row, setRow] = useState<Party | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!partyId || !UUID_RE.test(partyId)) return
    setErr(null)
    try {
      const r = await fetch(`/api/admin/parties/${partyId}`, { credentials: 'include' })
      const d = (await r.json().catch(() => ({}))) as { party?: Party; error?: string }
      if (r.status === 404) {
        setErr('not_found')
        return
      }
      if (!r.ok) {
        setErr('load')
        return
      }
      setRow(d.party ?? null)
    } catch {
      setErr('network')
    }
  }, [partyId])

  useEffect(() => {
    void load()
  }, [load])

  async function disable() {
    if (!partyId || !row) return
    if (
      !window.confirm(
        'Disable this party? Guests will be blocked from joining and from lyric/audio control.'
      )
    ) {
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch(`/api/admin/parties/${partyId}/disable`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!r.ok) {
        setErr('disable')
        return
      }
      await load()
    } catch {
      setErr('network')
    } finally {
      setBusy(false)
    }
  }

  if (!partyId || !UUID_RE.test(partyId)) {
    return <p className="text-sm text-white/80">Invalid party id.</p>
  }

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-black text-white">Party details</h2>
        <Link
          to="/admin/parties"
          className="text-sm font-bold text-amber-200 hover:text-amber-100"
        >
          ← All parties
        </Link>
      </div>
      {err && (
        <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {err === 'not_found' && 'Session not found.'}
          {err === 'load' && 'Could not load.'}
          {err === 'disable' && 'Could not disable.'}
          {err === 'network' && 'Network error.'}
        </p>
      )}
      {!row && !err && <p className="text-sm text-white/70">Loading…</p>}
      {row && (
        <div className="fs-card-lobby space-y-3 rounded-3xl border-2 border-white/15 p-4 text-sm text-white/90">
          <div>
            <span className="text-xs font-extrabold uppercase text-white/50">Party</span>
            <p className="text-lg font-black text-white">{row.partyName}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-xs font-extrabold uppercase text-white/50">Host</span>
              <p>
                {row.hostDisplayName} <span className="text-white/60">· {row.hostEmail}</span>
              </p>
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase text-white/50">Status</span>
              <p className="font-extrabold capitalize text-amber-100">{row.status}</p>
              {row.endedAt ? (
                <p className="mt-1 text-xs text-white/60">
                  Ended: {new Date(row.endedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase text-white/50">Guests</span>
              <p>
                {row.connectedGuestCount} online · max {row.maxGuests}
              </p>
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase text-white/50">Join code</span>
              <p className="font-mono text-cyan-100">{row.partyCode ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase text-white/50">Request status</span>
              <p className="capitalize">{row.requestStatus}</p>
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase text-white/50">Session created</span>
              <p>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-xs font-extrabold uppercase text-white/50">Active song</span>
              <p>{row.activeSong ? row.activeSong.title : '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-xs font-extrabold uppercase text-white/50">Current controller</span>
              <p>{row.currentController ? row.currentController.displayName : '—'}</p>
            </div>
          </div>
          {row.status !== 'disabled' && row.status !== 'ended' && (
            <div className="pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void disable()}
                className="rounded-2xl border-2 border-rose-400/50 bg-rose-600/80 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {busy ? 'Disabling…' : 'Disable party'}
              </button>
            </div>
          )}
          {row.status === 'ended' && (
            <p className="text-sm text-slate-200/90">
              The host ended this party. New joins and control are closed.
            </p>
          )}
          {row.status === 'disabled' && (
            <p className="text-sm text-rose-200/90">This party is disabled. Guests cannot join or control.</p>
          )}
        </div>
      )}
    </div>
  )
}
