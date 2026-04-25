import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StatusPill } from '../components/ui/StatusPill'

const PC = /^[A-Za-z0-9._-]{4,64}$/

type Row = {
  playlistItemId: string
  position: number
  id: string
  title: string
  difficulty: string | null
  tags: string[]
  audioReady: boolean
  lyricsReady: boolean
}

function songGradient(d: string | null) {
  if (!d) {
    return 'from-slate-500/30 to-fuchsia-600/20'
  }
  const x = d.toLowerCase()
  if (x.includes('easy') || x.includes('1')) {
    return 'from-emerald-500/30 to-cyan-500/25'
  }
  if (x.includes('hard') || x.includes('3')) {
    return 'from-rose-500/35 to-amber-500/25'
  }
  return 'from-amber-500/30 to-violet-500/25'
}

export function PartyGuestPlaylistPage() {
  const { partyCode } = useParams()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [req, setReq] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!partyCode || !PC.test(partyCode)) return
    setErr(null)
    try {
      const r = await fetch(`/api/party/${encodeURIComponent(partyCode)}/playlist`)
      const d = (await r.json().catch(() => ({}))) as { playlist?: Row[]; error?: string }
      if (r.status === 403) {
        setErr('unavailable')
        return
      }
      if (!r.ok) {
        setErr('load')
        return
      }
      setRows(d.playlist ?? [])
    } catch {
      setErr('network')
    }
  }, [partyCode])

  useEffect(() => {
    void load()
  }, [load])

  async function requestSong(songId: string) {
    if (!partyCode) return
    setReq(songId)
    setMsg(null)
    try {
      const r = await fetch(
        `/api/party/${encodeURIComponent(partyCode)}/request-song`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId })
        }
      )
      if (r.status === 401) {
        setMsg('join_first')
        return
      }
      if (!r.ok) {
        setMsg('fail')
        return
      }
      setMsg('ok')
    } catch {
      setMsg('network')
    } finally {
      setReq(null)
    }
  }

  if (!partyCode || !PC.test(partyCode)) {
    return <p className="text-sm text-white/80">Invalid code.</p>
  }

  return (
    <div className="mx-auto w-full min-h-[70dvh] max-w-2xl space-y-5 text-left sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black sm:text-3xl md:text-4xl">Song picks</h1>
        <Link
          to={`/party/${encodeURIComponent(partyCode)}`}
          className="min-h-11 touch-manipulation rounded-2xl bg-fuchsia-500/90 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-fuchsia-900/30"
        >
          Back to stage
        </Link>
      </div>

      {err === 'unavailable' && (
        <div className="fs-card-lobby rounded-3xl p-5" role="alert">
          <p className="text-3xl" aria-hidden>
            🚫
          </p>
          <h2 className="mt-2 text-xl font-black">Party isn&rsquo;t open</h2>
          <p className="mt-1 text-sm text-white/85">The host may have closed the room, or the link is wrong.</p>
        </div>
      )}
      {err && err !== 'unavailable' && (
        <p className="text-rose-100" role="alert">
          Could not load the list. Try again.
        </p>
      )}
      {msg === 'join_first' && (
        <p className="text-sm text-amber-100" role="status">
          Join the party from the room link first, then you can request songs.
        </p>
      )}
      {msg === 'ok' && (
        <p className="text-sm text-emerald-200" role="status">
          Nice — the host&rsquo;s list got your request!
        </p>
      )}
      {rows && rows.length === 0 && !err && (
        <div className="fs-card-lobby rounded-3xl p-8 text-center sm:p-10" role="status">
          <p className="text-4xl" aria-hidden>
            📭
          </p>
          <h2 className="mt-3 text-2xl font-black">No songs in the queue yet</h2>
          <p className="mt-2 text-balance text-sm text-white/85">
            The host is still building the setlist. Grab a drink and check back, or nudge the DJ!
          </p>
        </div>
      )}
      {rows && rows.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-1 lg:grid-cols-1">
          {rows.map((p) => (
            <li key={p.playlistItemId}>
              <div
                className={`fs-card-lobby overflow-hidden rounded-3xl border-2 border-white/25 bg-gradient-to-br p-0 shadow-xl sm:p-0 ${songGradient(p.difficulty)}`}
              >
                <div className="p-4 sm:p-5">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-white/70">In queue</p>
                  <h3 className="mt-1 text-balance text-lg font-extrabold text-white sm:text-xl">{p.title}</h3>
                  {p.difficulty ? (
                    <StatusPill kind="sync" className="mt-2 w-fit text-xs" icon={<span>🎚</span>}>
                      {p.difficulty}
                    </StatusPill>
                  ) : null}
                  {p.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Style tags">
                      {p.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-white/20 bg-slate-950/25 px-2.5 py-0.5 text-xs font-bold text-cyan-100"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {p.audioReady ? <StatusPill kind="success">Audio</StatusPill> : null}
                    {p.lyricsReady ? <StatusPill kind="default">Lyrics</StatusPill> : null}
                    {!p.audioReady && <span className="text-white/45">No audio in library</span>}
                    {!p.lyricsReady && <span className="text-white/45">No lyrics in library</span>}
                  </div>
                  <button
                    type="button"
                    className="mt-4 min-h-14 w-full touch-manipulation rounded-2xl bg-amber-300 py-3.5 text-sm font-extrabold text-slate-900 shadow-lg shadow-amber-900/30 active:scale-[0.99] disabled:opacity-50"
                    disabled={!!req}
                    aria-label={`Request ${p.title} for the party`}
                    onClick={() => void requestSong(p.id)}
                  >
                    {req === p.id ? 'Sending…' : 'Request this song for the room'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
