import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createPartySocket } from '../realtime/partySocket'
import { pickLineText } from '../lib/lyricText'
import { KaraokeOneDeviceAudio } from '../components/KaraokeOneDeviceAudio'
import { StatusPill } from '../components/ui/StatusPill'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PlItem = {
  playlistItemId: string
  position: number
  id: string
  title: string
  difficulty: string | null
  tags: string[]
  audioReady: boolean
  lyricsReady: boolean
}

type Sugg = {
  id: string
  title: string
  difficulty: string | null
  tags: string[]
  audioReady: boolean
  lyricsReady: boolean
  isDefaultSuggestion: boolean
}

type AvailableSong = Sugg
type BotSugg = Sugg & { reason: string }

type ControlReq = {
  id: string
  partyGuestId: string
  guestDisplayName: string
  songId: string | null
  songTitle?: string | null
  createdAt: string
}

type SongReq = {
  id: string
  partyGuestId: string
  guestDisplayName: string
  songId: string
  songTitle: string
  status: string
  createdAt: string
}

type KLine = {
  lineNumber: number
  textEnglish?: string
  textHindi?: string
  textHebrew?: string
}

type HostPartyKState = {
  currentLine?: KLine | null
  lyricContext?: { previousLine: KLine | null; nextLine: KLine | null }
  activeSong?: { id: string; title?: string; audioFileUrl?: string | null } | null
  playbackStatus?: string
  controllerAudioEnabled?: boolean
  connectedGuestCount?: number
  connectedGuests?: Array<{ id: string; displayName: string }>
  sessionStatus?: string
  controller?: { id: string; displayName: string } | null
}

function initialsFromName(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

function difficultyStyle(d: string | null): string {
  if (!d) {
    return 'from-slate-500/40 to-slate-600/30'
  }
  const x = d.toLowerCase()
  if (x.includes('easy') || x.includes('1')) {
    return 'from-emerald-500/50 to-cyan-500/40'
  }
  if (x.includes('hard') || x.includes('3')) {
    return 'from-rose-500/50 to-amber-500/40'
  }
  return 'from-amber-500/50 to-fuchsia-500/40'
}

function SongCard({
  children,
  title,
  difficulty,
  tags,
  audioReady,
  lyricsReady
}: {
  children?: React.ReactNode
  title: string
  difficulty: string | null
  tags: string[]
  audioReady: boolean
  lyricsReady: boolean
}) {
  return (
    <div
      className={`rounded-2xl border-2 border-white/20 bg-gradient-to-br p-3 text-left text-sm shadow-lg ${difficultyStyle(difficulty)} sm:p-4`}
    >
      <div className="rounded-xl bg-slate-950/45 p-3 ring-1 ring-white/10">
        <div className="text-base font-extrabold text-white sm:text-lg">{title}</div>
        {difficulty ? (
          <div className="mt-1 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-extrabold text-amber-100">
            {difficulty}
          </div>
        ) : null}
        {tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-bold text-cyan-100"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {audioReady ? (
            <span className="rounded-full bg-emerald-500/40 px-2.5 py-0.5 font-extrabold text-emerald-100">
              Audio
            </span>
          ) : (
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-white/50">No audio</span>
          )}
          {lyricsReady ? (
            <span className="rounded-full bg-sky-500/40 px-2.5 py-0.5 font-extrabold text-sky-100">
              Lyrics
            </span>
          ) : (
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-white/50">No lyrics</span>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

export function HostPartyPlaylistPage() {
  const { partyId } = useParams()
  const nav = useNavigate()
  const [partySessionId, setPartySessionId] = useState<string | null>(null)
  const [playlist, setPlaylist] = useState<PlItem[] | null>(null)
  const [availableSongs, setAvailableSongs] = useState<AvailableSong[] | null>(null)
  const [suggestions, setSuggestions] = useState<Sugg[] | null>(null)
  const [botSuggestions, setBotSuggestions] = useState<BotSugg[] | null>(null)
  const [controlReqs, setControlReqs] = useState<ControlReq[] | null>(null)
  const [songReqs, setSongReqs] = useState<SongReq[] | null>(null)
  const [maxPlaylistSongs, setMaxPlaylistSongs] = useState<number>(10)
  const [maxGuests, setMaxGuests] = useState<number>(30)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [karaoke, setKaraoke] = useState<HostPartyKState | null>(null)
  const hostSocketRef = useRef<import('socket.io-client').Socket | null>(null)

  const loadControl = useCallback(async () => {
    if (!partyId || !UUID_RE.test(partyId)) return
    try {
      const r = await fetch(`/api/host/parties/${partyId}/control-requests`, { credentials: 'include' })
      const d = (await r.json().catch(() => ({}))) as {
        requests?: ControlReq[]
        error?: string
      }
      if (r.ok) {
        setControlReqs(d.requests ?? [])
        return
      }
    } catch {
      // control list is best-effort
    }
  }, [partyId])

  const loadSongRequests = useCallback(async () => {
    if (!partyId || !UUID_RE.test(partyId)) return
    try {
      const r = await fetch(`/api/host/parties/${partyId}/song-requests`, { credentials: 'include' })
      const d = (await r.json().catch(() => ({}))) as {
        requests?: SongReq[]
      }
      if (r.ok) {
        setSongReqs(d.requests ?? [])
      }
    } catch {
      // best effort
    }
  }, [partyId])

  const load = useCallback(async () => {
    if (!partyId || !UUID_RE.test(partyId)) return
    setErr(null)
    try {
      const r = await fetch(`/api/host/parties/${partyId}/playlist`, { credentials: 'include' })
      const d = (await r.json().catch(() => ({}))) as {
        partySessionId?: string
        playlist?: PlItem[]
        maxPlaylistSongs?: number
        maxGuests?: number
        availableSongs?: AvailableSong[]
        botSuggestions?: BotSugg[]
        suggestions?: Sugg[]
        error?: string
      }
      if (!r.ok) {
        if (r.status === 403 && d.error === 'party_ended' && partyId) {
          nav(`/host/parties/${partyId}`, { replace: true })
          return
        }
        setErr(d.error || 'load')
        return
      }
      if (d.partySessionId) {
        setPartySessionId(d.partySessionId)
      }
      setPlaylist(d.playlist ?? [])
      if (typeof d.maxPlaylistSongs === 'number' && Number.isFinite(d.maxPlaylistSongs)) {
        setMaxPlaylistSongs(d.maxPlaylistSongs)
      }
      if (typeof d.maxGuests === 'number' && Number.isFinite(d.maxGuests)) {
        setMaxGuests(d.maxGuests)
      }
      setAvailableSongs(d.availableSongs ?? [])
      setBotSuggestions(d.botSuggestions ?? [])
      setSuggestions(d.suggestions ?? [])
      void loadControl()
      void loadSongRequests()
    } catch {
      setErr('network')
    }
  }, [partyId, loadControl, loadSongRequests, nav])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!partySessionId) {
      return
    }
    const socket = createPartySocket({
      partySessionId,
      role: 'host',
      withCredentials: true
    })
    hostSocketRef.current = socket
    const onReq = () => {
      void loadControl()
      void loadSongRequests()
    }
    const onPartyState = (s: HostPartyKState) => {
      setKaraoke({
        currentLine: s.currentLine ?? null,
        lyricContext: s.lyricContext,
        activeSong: s.activeSong,
        playbackStatus: s.playbackStatus,
        controllerAudioEnabled: s.controllerAudioEnabled,
        connectedGuestCount: s.connectedGuestCount,
        connectedGuests: s.connectedGuests,
        sessionStatus: s.sessionStatus,
        controller: s.controller
      })
    }
    const onPartyEnded = () => {
      if (partyId) {
        nav(`/host/parties/${partyId}`, { replace: true })
      }
    }
    const onGuestsUpdated = (payload: {
      connectedGuestCount?: number
      connectedGuests?: Array<{ id: string; displayName: string }>
    }) => {
      setKaraoke((prev) => ({
        ...(prev || {}),
        connectedGuestCount:
          typeof payload.connectedGuestCount === 'number'
            ? payload.connectedGuestCount
            : prev?.connectedGuestCount,
        connectedGuests: Array.isArray(payload.connectedGuests)
          ? payload.connectedGuests
          : prev?.connectedGuests
      }))
    }
    socket.on('control:requested', onReq)
    socket.on('party:state', onPartyState)
    socket.on('party:ended', onPartyEnded)
    socket.on('guests:updated', onGuestsUpdated)
    return () => {
      hostSocketRef.current = null
      socket.off('control:requested', onReq)
      socket.off('party:state', onPartyState)
      socket.off('party:ended', onPartyEnded)
      socket.off('guests:updated', onGuestsUpdated)
      socket.close()
    }
  }, [partySessionId, loadControl, loadSongRequests, partyId, nav])

  async function addSong(songId: string) {
    if (!partyId) return
    setBusy('add' + songId)
    setErr(null)
    try {
      const r = await fetch(`/api/host/parties/${partyId}/playlist/add`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId })
      })
      const d = (await r.json().catch(() => ({}))) as { playlist?: PlItem[]; error?: string }
      if (r.status === 409) {
        if (d.error === 'queue_full') {
          setErr('queue_full')
        } else {
          setErr('dup')
        }
        return
      }
      if (r.status === 400 && d.error === 'song_not_allowed') {
        setErr('not_allowed')
        return
      }
      if (!r.ok) {
        setErr('add')
        return
      }
      void load()
    } catch {
      setErr('network')
    } finally {
      setBusy(null)
    }
  }

  async function removeItem(itemId: string) {
    if (!partyId) return
    setBusy('rm' + itemId)
    setErr(null)
    try {
      const r = await fetch(`/api/host/parties/${partyId}/playlist/remove`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistItemId: itemId })
      })
      const d = (await r.json().catch(() => ({}))) as { playlist?: PlItem[]; error?: string }
      if (!r.ok) {
        setErr('remove')
        return
      }
      void load()
    } catch {
      setErr('network')
    } finally {
      setBusy(null)
    }
  }

  async function approveControl(requestId: string) {
    if (!partyId) return
    setBusy('ap' + requestId)
    setErr(null)
    try {
      const r = await fetch(`/api/host/control-requests/${requestId}/approve`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!r.ok) {
        setErr('control_approve')
        return
      }
      void loadControl()
    } catch {
      setErr('network')
    } finally {
      setBusy(null)
    }
  }

  async function rejectControl(requestId: string) {
    if (!partyId) return
    setBusy('rj' + requestId)
    setErr(null)
    try {
      const r = await fetch(`/api/host/control-requests/${requestId}/reject`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!r.ok) {
        setErr('control_reject')
        return
      }
      void loadControl()
    } catch {
      setErr('network')
    } finally {
      setBusy(null)
    }
  }

  async function approveSongRequest(requestId: string) {
    if (!partyId) return
    setBusy('sar' + requestId)
    setErr(null)
    try {
      const r = await fetch(`/api/host/parties/${partyId}/song-requests/${requestId}/approve`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string }
        if (d.error === 'queue_full') {
          setErr('queue_full')
        } else {
          setErr('song_request_approve')
        }
        return
      }
      void loadSongRequests()
      void load()
    } catch {
      setErr('network')
    } finally {
      setBusy(null)
    }
  }

  async function rejectSongRequest(requestId: string) {
    if (!partyId) return
    setBusy('srr' + requestId)
    setErr(null)
    try {
      const r = await fetch(`/api/host/parties/${partyId}/song-requests/${requestId}/reject`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!r.ok) {
        setErr('song_request_reject')
        return
      }
      void loadSongRequests()
    } catch {
      setErr('network')
    } finally {
      setBusy(null)
    }
  }

  async function takeControl() {
    if (!partyId) return
    setBusy('take')
    setErr(null)
    try {
      const r = await fetch(`/api/host/parties/${partyId}/take-control`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!r.ok) {
        setErr('take_control')
        return
      }
      void loadControl()
    } catch {
      setErr('network')
    } finally {
      setBusy(null)
    }
  }

  async function setControllerAudio(enabled: boolean) {
    if (!partyId) return
    setBusy('ca')
    setErr(null)
    try {
      const r = await fetch(`/api/host/parties/${encodeURIComponent(partyId)}/controller-audio`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      })
      if (!r.ok) {
        setErr('ca_toggle')
      }
    } catch {
      setErr('network')
    } finally {
      setBusy(null)
    }
  }

  async function endParty() {
    if (!partyId) return
    if (!window.confirm('End this party for everyone?')) return
    setBusy('endparty')
    setErr(null)
    try {
      const r = await fetch(`/api/host/parties/${encodeURIComponent(partyId)}/end-party`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        if (d.error === 'already_closed') {
          setErr('party_already_ended')
        } else {
          setErr('end_party')
        }
        return
      }
      nav(`/host/parties/${partyId}`, { replace: true })
    } catch {
      setErr('network')
    } finally {
      setBusy(null)
    }
  }

  async function startParty() {
    if (!partyId) return
    setBusy('startparty')
    setErr(null)
    try {
      const r = await fetch(`/api/host/parties/${encodeURIComponent(partyId)}/start-party`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(d.error || 'start_party')
        return
      }
      void load()
    } catch {
      setErr('network')
    } finally {
      setBusy(null)
    }
  }

  function move(idx: number, dir: -1 | 1) {
    if (!playlist || !partyId) return
    const next = playlist.slice()
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    const t = next[idx]
    next[idx] = next[j]
    next[j] = t
    setPlaylist(next)
    const ids = next.map((p) => p.playlistItemId)
    void (async () => {
      setBusy('reorder')
      setErr(null)
      try {
        const r = await fetch(`/api/host/parties/${partyId}/playlist/reorder`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedItemIds: ids })
        })
        const d = (await r.json().catch(() => ({}))) as { playlist?: PlItem[]; error?: string }
        if (!r.ok) {
          setErr('reorder')
          void load()
          return
        }
        if (d.playlist) setPlaylist(d.playlist)
      } catch {
        setErr('network')
        void load()
      } finally {
        setBusy(null)
      }
    })()
  }

  if (!partyId || !UUID_RE.test(partyId)) {
    return <p className="text-sm text-white/80">Invalid party id.</p>
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 text-left sm:space-y-5">
      <div className="fs-card space-y-3 rounded-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black sm:text-3xl">Party control</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="min-h-10 rounded-2xl border-2 border-rose-400/50 bg-rose-700/60 px-4 py-2 text-sm font-extrabold text-white ring-1 ring-rose-300/30 hover:bg-rose-600/80 disabled:opacity-50"
              disabled={!!busy}
              onClick={() => void endParty()}
            >
              End party
            </button>
            <Link
              to={`/host/parties/${partyId}`}
              className="min-h-10 inline-flex items-center rounded-2xl bg-white/15 px-4 py-2 text-sm font-extrabold text-white ring-1 ring-white/20 hover:bg-white/25"
            >
              Back
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {typeof karaoke?.connectedGuestCount === 'number' && (
            <StatusPill kind="sync" className="text-sm" icon={<span className="text-base">👥</span>}>
              {karaoke.connectedGuestCount}/{maxGuests} joined
            </StatusPill>
          )}
          {karaoke?.sessionStatus && (
            <StatusPill kind="success" className="text-sm capitalize">
              {karaoke.sessionStatus}
            </StatusPill>
          )}
        </div>
        {karaoke?.controller && (
          <p className="text-sm text-white/90">
            <span className="font-extrabold text-amber-200">On the mic: </span>
            <span className="font-bold text-white">{karaoke.controller.displayName}</span>
          </p>
        )}
      </div>
      {err && (
        <p className="text-sm text-rose-100">
          {err === 'dup' && 'That song is already in the list.'}
          {err === 'not_allowed' && 'Only published, unblocked songs can be added.'}
          {err === 'load' && 'Could not load playlist.'}
          {err === 'add' && 'Could not add song.'}
          {err === 'remove' && 'Could not remove.'}
          {err === 'reorder' && 'Could not save order. Restored from server.'}
          {err === 'control_approve' && 'Could not approve control request.'}
          {err === 'control_reject' && 'Could not reject control request.'}
          {err === 'song_request_approve' && 'Could not approve song request.'}
          {err === 'song_request_reject' && 'Could not reject song request.'}
          {err === 'queue_full' && 'Song queue is full.'}
          {err === 'take_control' && 'Could not take back control.'}
          {err === 'ca_toggle' && 'Could not update guest audio mode.'}
          {err === 'start_party' && 'Could not start party.'}
          {err === 'end_party' && 'Could not end the party. Try again.'}
          {err === 'party_already_ended' && 'This party was already ended.'}
          {err === 'network' && 'Network error.'}
          {![
            'dup',
            'not_allowed',
            'load',
            'add',
            'remove',
            'reorder',
            'control_approve',
            'control_reject',
            'take_control',
            'ca_toggle',
            'network'
          ].includes(err) && err}
        </p>
      )}

      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4 text-left sm:p-5">
        {(karaoke?.sessionStatus || 'approved') !== 'active' && (
          <div className="mb-3 rounded-2xl border border-cyan-300/40 bg-cyan-500/10 p-3">
            <p className="text-sm text-cyan-100">Party is waiting. Start now to switch room state to active.</p>
            <button
              type="button"
              className="mt-2 min-h-10 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
              disabled={!!busy}
              onClick={() => void startParty()}
            >
              Start party
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-black text-amber-100">Controller requests</h3>
          {karaoke?.controller && (
            <button
              type="button"
              className="rounded-2xl border border-white/25 px-3 py-1.5 text-xs font-bold text-amber-100"
              disabled={!!busy}
              onClick={() => void takeControl()}
            >
              Take back control
            </button>
          )}
        </div>
        {controlReqs && controlReqs.length === 0 && (
          <p className="mt-1 text-sm text-white/60">No pending requests.</p>
        )}
        {controlReqs && controlReqs.length > 0 && (
          <ul className="mt-2 space-y-2">
            {controlReqs.map((cr) => (
              <li
                key={cr.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-bold text-white">{cr.guestDisplayName}</div>
                  <div className="text-xs text-white/60">
                    Song: {cr.songTitle || cr.songId || 'Active song'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-500/40 px-2 py-1 text-xs font-bold text-white"
                    disabled={!!busy}
                    onClick={() => void approveControl(cr.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-rose-400/40 bg-rose-500/20 px-2 py-1 text-xs text-rose-100"
                    disabled={!!busy}
                    onClick={() => void rejectControl(cr.id)}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-left sm:p-5">
        <h3 className="text-lg font-black text-cyan-100">Song requests</h3>
        {songReqs && songReqs.length === 0 && (
          <p className="mt-1 text-sm text-white/60">No pending song requests.</p>
        )}
        {songReqs && songReqs.length > 0 && (
          <ul className="mt-2 space-y-2">
            {songReqs.map((sr) => (
              <li
                key={sr.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-bold text-white">{sr.songTitle}</div>
                  <div className="text-xs text-white/70">Requested by {sr.guestDisplayName}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-500/40 px-2 py-1 text-xs font-bold text-white"
                    disabled={!!busy}
                    onClick={() => void approveSongRequest(sr.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-rose-400/40 bg-rose-500/20 px-2 py-1 text-xs text-rose-100"
                    disabled={!!busy}
                    onClick={() => void rejectSongRequest(sr.id)}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {karaoke?.activeSong?.id && (
        <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4 text-left">
          <h3 className="text-lg font-black text-sky-100">Host lyric control</h3>
          {partyId && (
            <KaraokeOneDeviceAudio
              variant="host"
              partyRequestId={partyId}
              activeSong={karaoke.activeSong}
              playbackStatus={karaoke.playbackStatus}
            />
          )}
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-white/85">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/30"
              checked={!!karaoke.controllerAudioEnabled}
              disabled={!!busy}
              onChange={(e) => void setControllerAudio(e.target.checked)}
            />
            Let the approved guest use their phone for MP3 (one device — host or guest, not both).
          </label>
          {karaoke.activeSong?.title ? (
            <p className="mt-3 text-sm text-white/80">Now: {karaoke.activeSong.title}</p>
          ) : null}
          {karaoke.lyricContext?.previousLine ? (
            <p className="mt-2 text-xs text-white/40">
              {pickLineText(karaoke.lyricContext.previousLine, 'english') || '—'}
            </p>
          ) : null}
          <p className="mt-1 min-h-[2.5rem] text-2xl font-bold leading-tight text-white">
            {pickLineText(karaoke.currentLine ?? null, 'english') || '—'}
          </p>
          {karaoke.lyricContext?.nextLine ? (
            <p className="mt-2 text-sm text-white/55">Next: {pickLineText(karaoke.lyricContext.nextLine, 'english')}</p>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              type="button"
              className="min-h-[52px] rounded-2xl border-2 border-white/20 bg-white/10 py-3 text-sm font-bold text-white active:scale-[0.99]"
              onClick={() => hostSocketRef.current?.emit('lyrics:previous')}
            >
              Previous
            </button>
            <button
              type="button"
              className="min-h-[52px] rounded-2xl bg-fuchsia-500 py-3 text-sm font-bold text-white ring-2 ring-fuchsia-300/40 active:scale-[0.99]"
              onClick={() => hostSocketRef.current?.emit('lyrics:next')}
            >
              Next line
            </button>
            <button
              type="button"
              className="min-h-[52px] rounded-2xl border-2 border-white/20 bg-white/10 py-3 text-sm font-bold text-white active:scale-[0.99]"
              onClick={() => hostSocketRef.current?.emit('lyrics:restart')}
            >
              Restart
            </button>
            <button
              type="button"
              className="min-h-[52px] rounded-2xl border-2 border-rose-400/50 bg-rose-600/80 py-3 text-sm font-bold text-white active:scale-[0.99]"
              onClick={() => hostSocketRef.current?.emit('lyrics:finish')}
            >
              End song
            </button>
          </div>
        {Array.isArray(karaoke?.connectedGuests) && karaoke.connectedGuests.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {karaoke.connectedGuests.map((g) => (
              <div
                key={g.id}
                className="animate-[popIn_.2s_ease-out] rounded-2xl border border-white/20 bg-white/5 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-500/30 text-xs font-black text-fuchsia-100 ring-1 ring-fuchsia-200/30">
                    {initialsFromName(g.displayName)}
                  </span>
                  <span className="truncate text-sm font-bold text-white">{g.displayName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      )}
      <div>
        <h3 className="text-lg font-black text-amber-100">
          Queue <span className="text-sm font-bold text-amber-200">({playlist?.length ?? 0}/{maxPlaylistSongs} songs)</span>
        </h3>
        {!playlist && <p className="text-sm text-white/60">Loading…</p>}
        {playlist && playlist.length === 0 && (
          <div className="mt-2 rounded-2xl border-2 border-dashed border-amber-400/40 bg-amber-500/5 p-6 text-center" role="status">
            <p className="text-3xl" aria-hidden>
              🎧
            </p>
            <p className="mt-2 font-extrabold text-amber-100">Queue is empty</p>
            <p className="mt-1 text-sm text-white/70">Pick songs from the suggestions to build the set.</p>
          </div>
        )}
        {playlist && playlist.length > 0 && (
          <ul className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {playlist.map((p, idx) => (
              <li key={p.playlistItemId}>
                <SongCard
                  title={`${p.position + 1}. ${p.title}`}
                  difficulty={p.difficulty}
                  tags={p.tags}
                  audioReady={p.audioReady}
                  lyricsReady={p.lyricsReady}
                >
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded-lg border border-white/20 px-2 py-1 text-xs"
                      disabled={!!busy}
                      onClick={() => move(idx, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-white/20 px-2 py-1 text-xs"
                      disabled={!!busy}
                      onClick={() => move(idx, 1)}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-400/40 bg-rose-500/20 px-2 py-1 text-xs text-rose-100"
                      disabled={!!busy}
                      onClick={() => void removeItem(p.playlistItemId)}
                    >
                      Remove
                    </button>
                  </div>
                </SongCard>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="text-lg font-black text-amber-100">Suggested Songs</h3>
        <p className="text-xs text-white/60">
          Picks from your approved library only (no web scraping). Uses tags, default picks, and your party
          request text when it helps. Complete MP3 + lyrics required.
        </p>
        {!botSuggestions && <p className="mt-2 text-sm text-white/60">Loading…</p>}
        {botSuggestions && botSuggestions.length === 0 && (
          <div
            className="mt-2 rounded-2xl border-2 border-dashed border-cyan-400/35 bg-cyan-500/5 p-5 text-center"
            role="status"
          >
            <p className="text-2xl" aria-hidden>
              🤖
            </p>
            <p className="mt-2 font-extrabold text-cyan-100">No bot picks right now</p>
            <p className="mt-1 text-sm text-white/70">
              All eligible songs may already be in the queue, or the library needs more published songs with
              MP3 and lyrics. Try the default list below.
            </p>
          </div>
        )}
        {botSuggestions && botSuggestions.length > 0 && (
          <ul className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            {botSuggestions.map((s) => {
              const onList = playlist?.some((p) => p.id === s.id)
              return (
                <li key={s.id}>
                  <SongCard
                    title={s.title}
                    difficulty={s.difficulty}
                    tags={s.tags}
                    audioReady={s.audioReady}
                    lyricsReady={s.lyricsReady}
                  >
                    <p className="mt-2 text-xs font-extrabold text-cyan-200/95">{s.reason}</p>
                    {onList ? (
                      <p className="mt-1 text-xs text-white/50">Already in queue</p>
                    ) : (
                      <button
                        type="button"
                        className="mt-2 rounded-2xl bg-cyan-500 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 hover:bg-cyan-400 disabled:opacity-50"
                        disabled={!!busy}
                        onClick={() => void addSong(s.id)}
                      >
                        Add to playlist
                      </button>
                    )}
                  </SongCard>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div>
        <h3 className="text-lg font-black text-amber-100">Available Songs</h3>
        <p className="text-xs text-white/60">Published and unblocked songs available to add.</p>
        {availableSongs && availableSongs.length === 0 && (
          <p className="mt-2 text-sm text-white/70">No available songs in the library.</p>
        )}
        {availableSongs && availableSongs.length > 0 && (
          <ul className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            {availableSongs.map((s) => {
              const onList = playlist?.some((p) => p.id === s.id)
              return (
                <li key={s.id}>
                  <SongCard
                    title={s.title}
                    difficulty={s.difficulty}
                    tags={s.tags}
                    audioReady={s.audioReady}
                    lyricsReady={s.lyricsReady}
                  >
                    {onList ? (
                      <p className="mt-2 text-xs text-white/50">Already in queue</p>
                    ) : (
                      <button
                        type="button"
                        className="mt-2 rounded-2xl bg-fuchsia-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                        disabled={!!busy}
                        onClick={() => void addSong(s.id)}
                      >
                        Add to playlist
                      </button>
                    )}
                  </SongCard>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
