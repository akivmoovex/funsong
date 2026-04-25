import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { StatusPill } from '@/components/ui/StatusPill'

const PC = /^[A-Za-z0-9._-]{4,64}$/
type Lang = 'english' | 'hindi' | 'hebrew'
const LANGS: { id: Lang; label: string }[] = [
  { id: 'english', label: 'English' },
  { id: 'hindi', label: 'Hindi' },
  { id: 'hebrew', label: 'Hebrew' }
]

type Preview = {
  canJoin: boolean
  full: boolean
  reason: string | null
  currentGuests: number
  maxGuests: number
  partyTitle: string | null
  status: string
}

export function JoinPage() {
  const { partyCode } = useParams()
  const nav = useNavigate()
  const [loading, setLoading] = useState(!!partyCode)
  const [notFound, setNotFound] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [lang, setLang] = useState<Lang>('english')
  const [formErr, setFormErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (document.querySelector('meta[name="robots"][data-funsong-guest]')) {
      return
    }
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'robots')
    meta.setAttribute('content', 'noindex, nofollow')
    meta.setAttribute('data-funsong-join-only', '1')
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [])

  useEffect(() => {
    if (!partyCode) return
    if (!PC.test(partyCode)) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let c = false
    void (async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/join/${encodeURIComponent(partyCode)}`, {
          credentials: 'include'
        })
        if (r.status === 404) {
          if (!c) {
            setNotFound(true)
            setPreview(null)
          }
          return
        }
        if (!r.ok) {
          if (!c) setFormErr('load')
          return
        }
        const b = (await r.json()) as { preview: Preview }
        if (!c) {
          setPreview(b.preview)
          setNotFound(false)
        }
      } catch {
        if (!c) setFormErr('network')
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [partyCode])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!partyCode) return
    setFormErr(null)
    setSaving(true)
    try {
      const r = await fetch(`/api/join/${encodeURIComponent(partyCode)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim(), language: lang })
      })
      const b = (await r.json().catch(() => ({}))) as { redirect?: string; error?: string }
      if (r.status === 409) {
        setFormErr('full')
        return
      }
      if (r.status === 403) {
        setFormErr('blocked')
        return
      }
      if (r.status === 400 && b.error === 'invalid_language') {
        setFormErr('lang')
        return
      }
      if (!r.ok) {
        setFormErr(b.error || 'join')
        return
      }
      if (b.redirect) {
        nav(b.redirect)
        return
      }
      nav(`/party/${encodeURIComponent(partyCode)}`)
    } catch {
      setFormErr('network')
    } finally {
      setSaving(false)
    }
  }

  if (!partyCode) {
    return (
      <div className="fs-card space-y-4 text-left">
        <h2 className="text-2xl font-black">Join a party</h2>
        <p className="text-sm text-white/80">
          Open a join link in the form <span className="font-mono">/join/…</span> from the
          host&rsquo;s invite or scan their QR. No account needed.
        </p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-[80dvh] flex flex-col justify-center text-center sm:text-left">
        <h1 className="text-2xl font-black sm:text-3xl">We don&rsquo;t know this party</h1>
        <p className="mt-2 text-sm text-white/80">Check the code or ask the host for a new link.</p>
      </div>
    )
  }

  if (loading && !preview) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center text-sm text-white/70">
        Loading…
      </div>
    )
  }

  if (preview) {
    if (!preview.canJoin && !preview.full) {
      const st = String(preview.status || preview.reason || '').toLowerCase()
      if (st === 'pending' || st === 'submitted' || st === 'draft') {
        return (
          <div className="min-h-[80dvh] flex flex-col items-center justify-center text-center sm:items-start sm:text-left">
            <div className="fs-card-lobby w-full max-w-md rounded-3xl p-6">
              <p className="text-4xl" aria-hidden>
                ⏳
              </p>
              <h1 className="mt-3 text-2xl font-black sm:text-3xl">Room almost ready</h1>
              <p className="mt-2 text-balance text-sm text-white/85">
                The host&rsquo;s party isn&rsquo;t open for guests yet, or it&rsquo;s still being approved. Check
                back in a few minutes or ask the host to start the room.
              </p>
            </div>
          </div>
        )
      }
    }
    if (preview.reason === 'ended' || preview.status === 'ended') {
      return (
        <div className="min-h-[100dvh] -mx-4 -my-6 flex flex-col items-center justify-center bg-slate-900/50 px-6 text-center sm:-mx-0 sm:-my-0 sm:rounded-3xl sm:bg-transparent">
          <h1 className="text-2xl font-black sm:text-3xl">This party has ended</h1>
          <p className="mt-2 max-w-sm text-sm text-white/80">You can&rsquo;t join anymore.</p>
        </div>
      )
    }
    if (preview.reason === 'disabled' || preview.status === 'disabled') {
      return (
        <div className="min-h-[100dvh] -mx-4 -my-6 flex flex-col items-center justify-center bg-rose-950/40 px-6 text-center sm:-mx-0 sm:-my-0 sm:rounded-3xl sm:bg-rose-950/20">
          <h1 className="text-2xl font-black sm:text-3xl">This party is unavailable</h1>
          <p className="mt-2 max-w-sm text-sm text-white/80">The host or admin has disabled it.</p>
        </div>
      )
    }
    if (preview.full || (preview.currentGuests >= preview.maxGuests && !preview.canJoin)) {
      return (
        <div className="min-h-[100dvh] -mx-4 -my-6 flex flex-col items-center justify-center bg-amber-950/30 px-5 text-center sm:-mx-0 sm:-my-0 sm:rounded-3xl sm:bg-amber-950/20">
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">Party&rsquo;s full!</h1>
          <p className="mt-3 text-base text-amber-100/90">
            {preview.maxGuests} phones are in — the room is at capacity. Try again if someone
            leaves.
          </p>
        </div>
      )
    }
  }

  return (
    <div className="min-h-[80dvh] flex flex-col justify-end pb-4 sm:justify-center sm:pb-0">
      <div className="space-y-4 text-left">
        <h1 className="text-3xl font-black leading-tight sm:text-4xl">
          {preview?.partyTitle
            ? `You’re almost in “${preview.partyTitle}”`
            : 'You’re almost in!'}
        </h1>
        {preview && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Room occupancy">
            <StatusPill kind="sync" icon={<span aria-hidden>👥</span>}>
              {preview.currentGuests} / {preview.maxGuests} in the room
            </StatusPill>
          </div>
        )}
        <form
          onSubmit={onSubmit}
          className="mt-4 space-y-3 rounded-3xl border-2 border-white/15 bg-white/5 p-4 shadow-xl shadow-black/20"
        >
          <div>
            <label
              className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/60"
              htmlFor="fs-join-name"
            >
              How should we call you?
            </label>
            <input
              id="fs-join-name"
              name="displayName"
              required
              className="min-h-[3rem] w-full touch-manipulation rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-base font-bold text-white placeholder:text-white/40"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
              autoComplete="name"
            />
          </div>
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-white/60">Lyric language</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Lyrics language">
              {LANGS.map((o) => {
                const on = lang === o.id
                const base =
                  o.id === 'english'
                    ? 'from-cyan-500/30 to-cyan-600/20 border-cyan-300/50'
                    : o.id === 'hindi'
                      ? 'from-amber-500/30 to-rose-500/20 border-amber-200/50'
                      : 'from-fuchsia-500/35 to-violet-600/25 border-fuchsia-200/50'
                return (
                  <label
                    key={o.id}
                    className={[
                      'flex min-h-14 cursor-pointer touch-manipulation items-center justify-center rounded-2xl border-2 bg-gradient-to-br px-3 text-sm font-extrabold transition',
                      base,
                      on ? 'text-white ring-2 ring-amber-200/60' : 'border-white/20 opacity-90'
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="lang"
                      className="sr-only"
                      checked={on}
                      onChange={() => setLang(o.id)}
                    />
                    <span
                      className={o.id === 'hindi' ? 'fs-text-hi' : o.id === 'hebrew' ? 'fs-text-he' : undefined}
                    >
                      {o.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          {formErr && (
            <p className="text-sm text-rose-200" role="alert">
              {formErr === 'full' && "Room's full. Try again later."}
              {formErr === 'blocked' && 'You cannot join this party right now.'}
              {formErr === 'lang' && 'Pick a valid language.'}
              {formErr === 'network' && 'Connection problem. Try again.'}
              {formErr === 'load' && "Couldn't load the party. Try again."}
              {formErr === 'join' && "Couldn't join. Please try again."}
              {![
                'full',
                'blocked',
                'lang',
                'network',
                'load',
                'join'
              ].includes(formErr) && `Something went wrong (${formErr})`}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="min-h-[3.5rem] w-full touch-manipulation rounded-2xl bg-fuchsia-500 py-3 text-base font-black text-white shadow-lg shadow-fuchsia-500/30 active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? 'Joining…' : 'Go to the party →'}
          </button>
        </form>
        <p className="text-center text-xs text-white/50 sm:text-left">No sign-in. One tap on your name.</p>
      </div>
    </div>
  )
}
