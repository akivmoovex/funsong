import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type SettingsModel = {
  maxPartyGuests: number
  maxPlaylistSongs: number
  partyAutoCloseMinutes: number
}

export function AdminSettingsPage() {
  const [form, setForm] = useState<SettingsModel>({
    maxPartyGuests: 30,
    maxPlaylistSongs: 10,
    partyAutoCloseMinutes: 300
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    void (async () => {
      try {
        const r = await fetch('/api/admin/settings', { credentials: 'include' })
        const d = (await r.json().catch(() => ({}))) as { settings?: SettingsModel; error?: string }
        if (!r.ok) {
          if (!cancel) setErr(d.error || 'load_failed')
          return
        }
        if (!cancel && d.settings) {
          setForm({
            maxPartyGuests: Number(d.settings.maxPartyGuests || 30),
            maxPlaylistSongs: Number(d.settings.maxPlaylistSongs || 10),
            partyAutoCloseMinutes: Number(d.settings.partyAutoCloseMinutes || 300)
          })
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setOk(null)
    try {
      const r = await fetch('/api/admin/settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const d = (await r.json().catch(() => ({}))) as { settings?: SettingsModel; error?: string; key?: string }
      if (!r.ok) {
        if (d.error === 'invalid_integer') {
          setErr('Please enter integer values only.')
          return
        }
        if (d.error === 'invalid_range') {
          setErr(`Invalid range for ${String(d.key || 'setting')}.`)
          return
        }
        setErr(d.error || 'save_failed')
        return
      }
      if (d.settings) {
        setForm(d.settings)
      }
      setOk('Settings saved successfully.')
    } catch {
      setErr('network')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-black text-white">Settings</h2>
        <Link to="/admin" className="text-sm font-bold text-amber-200 hover:text-amber-100">
          Admin home
        </Link>
      </div>
      <p className="text-sm text-white/80">
        Configure global app limits for party size, queue size, and auto-close timing.
      </p>
      <form onSubmit={onSubmit} className="fs-card-lobby space-y-4 border border-white/20 p-4">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/65">
            Max number of guests (1-100)
          </label>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={form.maxPartyGuests}
            onChange={(e) => setForm((s) => ({ ...s, maxPartyGuests: Number(e.target.value) }))}
            className="w-full rounded-2xl border-2 border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/65">
            Max songs in list (1-100)
          </label>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={form.maxPlaylistSongs}
            onChange={(e) => setForm((s) => ({ ...s, maxPlaylistSongs: Number(e.target.value) }))}
            className="w-full rounded-2xl border-2 border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/65">
            Auto-close party in minutes (5-1440)
          </label>
          <input
            type="number"
            min={5}
            max={1440}
            step={1}
            value={form.partyAutoCloseMinutes}
            onChange={(e) =>
              setForm((s) => ({ ...s, partyAutoCloseMinutes: Number(e.target.value) }))
            }
            className="w-full rounded-2xl border-2 border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
            required
          />
        </div>
        {err && (
          <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {err}
          </p>
        )}
        {ok && (
          <p className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {ok}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-extrabold text-slate-900 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </div>
  )
}
