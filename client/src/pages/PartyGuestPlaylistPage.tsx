import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StatusPill } from '../components/ui/StatusPill'
import { createPartySocket } from '../realtime/partySocket'

const PC = /^[A-Za-z0-9._-]{4,64}$/

type Row = {
  playlistItemId: string
  position: number
  status: 'queued' | 'active' | 'completed' | 'skipped'
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

function statusKind(status: Row['status']): 'sync' | 'success' | 'warning' | 'default' {
  if (status === 'active') return 'sync'
  if (status === 'completed') return 'success'
  if (status === 'skipped') return 'warning'
  return 'default'
}

function statusLabel(status: Row['status']): string {
  if (status === 'active') return 'active'
  if (status === 'completed') return 'completed'
  if (status === 'skipped') return 'skipped'
  return 'queued'
}

export function PartyGuestPlaylistPage() {
  const { partyCode } = useParams()
  const [partySessionId, setPartySessionId] = useState<string | null>(null)
  const [partyClosed, setPartyClosed] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [req, setReq] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [controlReq, setControlReq] = useState<string | null>(null)
  const [controlMsg, setControlMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!partyCode || !PC.test(partyCode)) return
    setErr(null)
    try {
      const info = await fetch(`/api/party/${encodeURIComponent(partyCode)}`, {
        credentials: 'include'
      })
      const infoBody = (await info.json().catch(() => ({}))) as {
        session?: { id?: string; status?: string }
      }
      const st = String(infoBody?.session?.status || '').toLowerCase()
      const sid = String(infoBody?.session?.id || '')
      if (sid) {
        setPartySessionId(sid)
      }
      if (st === 'ended' || st === 'disabled') {
        setPartyClosed(true)
        setRows([])
        return
      }
      setPartyClosed(false)

      const r = await fetch(`/api/party/${encodeURIComponent(partyCode)}/playlist`)
      const d = (await r.json().catch(() => ({}))) as { playlist?: Row[]; error?: string }
      if (r.status === 403) {
        if (d.error === 'not_available') {
          setPartyClosed(true)
          setErr(null)
          return
        }
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

  useEffect(() => {
    if (!partySessionId) {
      return
    }
    const socket = createPartySocket({
      partySessionId,
      role: 'guest',
      withCredentials: true
    })
    const onPlaylistUpdated = () => {
      void load()
    }
    const onPartyEnded = () => {
      setPartyClosed(true)
      setErr(null)
    }
    const onPartyState = (s: { sessionStatus?: string }) => {
      const st = String(s?.sessionStatus || '').toLowerCase()
      if (st === 'ended' || st === 'disabled') {
        setPartyClosed(true)
      }
    }
    socket.on('playlist:updated', onPlaylistUpdated)
    socket.on('party:ended', onPartyEnded)
    socket.on('party:state', onPartyState)
    return () => {
      socket.off('playlist:updated', onPlaylistUpdated)
      socket.off('party:ended', onPartyEnded)
      socket.off('party:state', onPartyState)
      socket.close()
    }
  }, [partySessionId, load])

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
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        if (d.error === 'song_request_already_pending') {
          setMsg('pending')
          return
        }
        if (d.error === 'song_already_in_playlist') {
          setMsg('already')
          return
        }
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

  async function requestControl(songId: string) {
    if (!partyCode) return
    setControlReq(songId)
    setControlMsg(null)
    try {
      const r = await fetch(`/api/party/${encodeURIComponent(partyCode)}/request-control`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId })
      })
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      if (r.status === 201) {
        setControlMsg('ok')
        return
      }
      if (d.error === 'control_already_pending') {
        setControlMsg('pending')
        return
      }
      if (d.error === 'song_not_in_playlist') {
        setControlMsg('song_missing')
        return
      }
      setControlMsg('fail')
    } catch {
      setControlMsg('network')
    } finally {
      setControlReq(null)
    }
  }

  if (!partyCode || !PC.test(partyCode)) {
    return <p className="text-sm text-white/80">Invalid code.</p>
  }

  if (partyClosed) {
    return (
      <div className="fs-card-lobby mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center rounded-3xl p-6 text-center">
        <p className="text-4xl" aria-hidden>
          🎤
        </p>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">This party has ended</h1>
        <p className="mt-2 text-balance text-sm text-white/85">
          The host closed the room. Song requests and controls are no longer available.
        </p>
        <Link
          to={`/party/${encodeURIComponent(partyCode)}`}
          className="mt-4 rounded-2xl bg-white/20 px-4 py-2 text-sm font-extrabold text-white"
        >
          Back to stage
        </Link>
      </div>
    )
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
      {msg === 'pending' && (
        <p className="text-sm text-amber-100" role="status">
          You already requested this song. Waiting for host decision.
        </p>
      )}
      {msg === 'already' && (
        <p className="text-sm text-cyan-100" role="status">
          This song is already approved/in queue.
        </p>
      )}
      {controlMsg === 'ok' && (
        <p className="text-sm text-emerald-200" role="status">
          Control request sent. Host can approve you to sing.
        </p>
      )}
      {controlMsg === 'pending' && (
        <p className="text-sm text-amber-100" role="status">
          You already have a pending control request.
        </p>
      )}
      {controlMsg === 'song_missing' && (
        <p className="text-sm text-amber-100" role="status">
          That song is no longer in the playlist.
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
                  <StatusPill
                    kind={statusKind(p.status)}
                    className="mt-2 w-fit text-xs capitalize"
                    icon={<span>🎵</span>}
                  >
                    {statusLabel(p.status)}
                  </StatusPill>
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
                    disabled={!!req || p.status === 'completed' || p.status === 'skipped'}
                    aria-label={`Request ${p.title} for the party`}
                    onClick={() => void requestSong(p.id)}
                  >
                    {req === p.id
                      ? 'Sending…'
                      : p.status === 'completed' || p.status === 'skipped'
                        ? 'Song closed'
                        : 'Request this song for the room'}
                  </button>
                  <button
                    type="button"
                    className="mt-2 min-h-12 w-full touch-manipulation rounded-2xl border border-cyan-200/35 bg-cyan-500/30 py-3 text-sm font-extrabold text-white active:scale-[0.99] disabled:opacity-50"
                    disabled={!!controlReq || p.status === 'completed' || p.status === 'skipped'}
                    aria-label={`Request control for ${p.title}`}
                    onClick={() => void requestControl(p.id)}
                  >
                    {controlReq === p.id ? 'Sending…' : 'I want to sing this'}
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
