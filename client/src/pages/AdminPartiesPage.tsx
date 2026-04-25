import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type Party = {
  id: string
  partyName: string
  hostEmail: string
  hostDisplayName: string
  status: string
  endedAt?: string | null
  maxGuests: number
  partyCode: string | null
  createdAt: string
  connectedGuestCount: number
  activeSong: { id: string; title: string } | null
  currentController: { id: string; displayName: string } | null
}

export function AdminPartiesPage() {
  const [rows, setRows] = useState<Party[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setErr(null)
    try {
      const r = await fetch('/api/admin/parties', { credentials: 'include' })
      const d = (await r.json()) as { parties?: Party[] }
      if (!r.ok) {
        setErr('load_failed')
        return
      }
      setRows(d.parties ?? [])
    } catch {
      setErr('network')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-black text-white">Parties</h2>
          <p className="mt-1 text-sm text-white/70">
            Monitor active and approved host parties (plus ended/disabled history), newest first.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link to="/admin/party-requests" className="font-bold text-amber-200 hover:text-amber-100">
            Legacy review queue
          </Link>
          <Link to="/admin" className="font-bold text-amber-200 hover:text-amber-100">
            Admin home
          </Link>
        </div>
      </div>
      {err && (
        <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {err}
        </p>
      )}
      {rows && rows.length === 0 && !err && (
        <p className="text-sm text-white/80">No live party sessions right now.</p>
      )}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-xs font-extrabold uppercase tracking-wide text-white/60">
                <th className="p-3">Party</th>
                <th className="p-3">Host</th>
                <th className="p-3">Status</th>
                <th className="p-3">Guests</th>
                <th className="p-3">Now playing</th>
                <th className="p-3">Controller</th>
                <th className="p-3">Created</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="p-3 font-bold text-white">
                    {p.partyName}
                    {p.partyCode ? (
                      <span className="mt-0.5 block font-mono text-xs font-normal text-cyan-200/80">
                        {p.partyCode}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3 text-white/90">
                    {p.hostDisplayName}
                    <span className="block text-xs text-white/50">{p.hostEmail}</span>
                  </td>
                  <td className="p-3">
                    <span
                      className={
                        p.status === 'active'
                          ? 'font-extrabold text-emerald-200'
                          : p.status === 'approved'
                            ? 'font-extrabold text-sky-200'
                            : p.status === 'ended'
                              ? 'font-extrabold text-slate-200'
                              : 'text-white/80'
                      }
                    >
                      {p.status}
                    </span>
                    {p.endedAt ? (
                      <span className="mt-0.5 block text-xs text-white/50">
                        {new Date(p.endedAt).toLocaleString()}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3 text-white/90">
                    {p.connectedGuestCount} / {p.maxGuests}
                  </td>
                  <td className="p-3 text-white/90">{p.activeSong?.title ?? '—'}</td>
                  <td className="p-3 text-white/90">{p.currentController?.displayName ?? '—'}</td>
                  <td className="p-3 text-xs text-white/60">
                    {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="p-3">
                    <Link
                      to={`/admin/parties/${p.id}`}
                      className="font-extrabold text-amber-200 hover:text-amber-100"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
