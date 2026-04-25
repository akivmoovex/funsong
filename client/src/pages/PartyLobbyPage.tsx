import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { Link, useParams } from 'react-router-dom'
import { createPartySocket } from '../realtime/partySocket'
import { pickLineText } from '../lib/lyricText'
import { karaokeVisibleLineNumbers } from '../lib/lyricPreview'
import { KaraokeOneDeviceAudio, type KaraokeAudioVariant } from '../components/KaraokeOneDeviceAudio'
import { PartyCodeQrCard } from '../components/party/PartyCodeQrCard'
import { SongFinishedConfetti } from '../components/party/SongFinishedConfetti'
import { StatusPill } from '../components/ui/StatusPill'

const PC = /^[A-Za-z0-9._-]{4,64}$/

type KaraokeLine = {
  lineNumber: number
  textEnglish?: string
  textHindi?: string
  textHebrew?: string
}

type PartyKState = {
  currentLineNumber?: number
  currentLine?: KaraokeLine | null
  lyricContext?: { previousLine: KaraokeLine | null; nextLine: KaraokeLine | null }
  activeSong?: { id: string; title?: string; audioFileUrl?: string | null } | null
  lyricLines?: KaraokeLine[]
  controller?: { id: string; displayName: string } | null
  controllerAudioEnabled?: boolean
  playbackStatus?: string
  connectedGuestCount?: number
  connectedGuests?: Array<{ id: string; displayName: string }>
  sessionStatus?: string
}

type LobbyPlaylistItem = {
  playlistItemId: string
  position: number
  status?: 'queued' | 'active' | 'completed' | 'skipped'
  title: string
}

function initialsFromName(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export function PartyLobbyPage() {
  const { partyCode } = useParams()
  const [data, setData] = useState<{
    guestId: string
    displayName: string
    languagePreference: string
    partySessionId: string
    sessionStatus?: string
  } | null>(null)
  const [partyClosed, setPartyClosed] = useState(false)
  const [k, setK] = useState<PartyKState | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [reqMsg, setReqMsg] = useState<string | null>(null)
  const [reqBusy, setReqBusy] = useState(false)
  const [lyricErr, setLyricErr] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const [partySocket, setPartySocket] = useState<Socket | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [partyTitle, setPartyTitle] = useState<string | null>(null)
  const [playlistPreview, setPlaylistPreview] = useState<LobbyPlaylistItem[]>([])
  const [maxGuests, setMaxGuests] = useState<number>(30)
  const [isLandscapePhone, setIsLandscapePhone] = useState(false)

  useEffect(() => {
    if (!partyCode || !PC.test(partyCode)) {
      setErr('invalid')
      return
    }
    let cancel = false
    void (async () => {
      try {
        const previewResp = await fetch(`/api/join/${encodeURIComponent(partyCode)}`, {
          credentials: 'include'
        })
        const previewBody = (await previewResp.json().catch(() => ({}))) as {
          preview?: { partyTitle?: string | null; maxGuests?: number }
        }
        if (!cancel) {
          setPartyTitle(previewBody.preview?.partyTitle || null)
          if (
            typeof previewBody.preview?.maxGuests === 'number' &&
            Number.isFinite(previewBody.preview.maxGuests)
          ) {
            setMaxGuests(previewBody.preview.maxGuests)
          }
        }
        const r = await fetch(`/api/party/${encodeURIComponent(partyCode)}`, {
          credentials: 'include'
        })
        const d = (await r.json().catch(() => ({}))) as {
          guest?: { id: string; displayName: string; languagePreference: string }
          session?: { id: string; status?: string }
          error?: string
        }
        if (r.status === 401) {
          if (!cancel) setErr('unauthorized')
          return
        }
        if (!r.ok) {
          if (!cancel) setErr(d.error || 'load')
          return
        }
        if (d.guest && d.session?.id && !cancel) {
          const st = String(d.session?.status || '').toLowerCase()
          if (st === 'ended' || st === 'disabled') {
            setPartyClosed(true)
            setData(null)
            setErr(null)
            return
          }
          setData({
            guestId: d.guest.id,
            displayName: d.guest.displayName,
            languagePreference: d.guest.languagePreference,
            partySessionId: d.session.id,
            sessionStatus: d.session.status
          })
          setErr(null)
        } else if (!cancel) {
          setErr('load')
        }
      } catch {
        if (!cancel) setErr('network')
      }
    })()
    return () => {
      cancel = true
    }
  }, [partyCode])

  useEffect(() => {
    if (!partyCode || !PC.test(partyCode)) return
    let cancel = false
    void (async () => {
      const r = await fetch(`/api/party/${encodeURIComponent(partyCode)}/playlist`, {
        credentials: 'include'
      })
      const d = (await r.json().catch(() => ({}))) as { playlist?: LobbyPlaylistItem[] }
      if (!cancel && r.ok) {
        setPlaylistPreview(Array.isArray(d.playlist) ? d.playlist : [])
      }
    })()
    return () => {
      cancel = true
    }
  }, [partyCode])

  useEffect(() => {
    if (!data?.partySessionId) return
    const socket = createPartySocket({
      partySessionId: data.partySessionId,
      role: 'guest',
      withCredentials: true
    })
    socketRef.current = socket
    setPartySocket(socket)
    const onLyricErr = (e: { error?: string }) => {
      if (e?.error === 'forbidden') {
        setLyricErr('Only the host or the approved controller can change the line.')
      } else if (e?.error) {
        setLyricErr(`Could not update line (${e.error}).`)
      }
    }
    const onStateEnded = (s: PartyKState) => {
      setK(s)
      if (String(s.sessionStatus || '').toLowerCase() === 'ended') {
        setPartyClosed(true)
      }
    }
    socket.on('party:state', onStateEnded)
    socket.on('lyrics:updated', () => {
      setLyricErr(null)
    })
    socket.on('lyrics:error', onLyricErr)
    const onSongFinished = () => {
      setShowConfetti(true)
    }
    const onPartyEnded = () => {
      setPartyClosed(true)
    }
    const onGuestsUpdated = (payload: {
      connectedGuestCount?: number
      connectedGuests?: Array<{ id: string; displayName: string }>
    }) => {
      setK((prev) => ({
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
    const onPlaylistUpdated = async () => {
      if (!partyCode) return
      const r = await fetch(`/api/party/${encodeURIComponent(partyCode)}/playlist`, {
        credentials: 'include'
      })
      const d = (await r.json().catch(() => ({}))) as { playlist?: LobbyPlaylistItem[] }
      if (r.ok) {
        setPlaylistPreview(Array.isArray(d.playlist) ? d.playlist : [])
      }
    }
    socket.on('song:finished', onSongFinished)
    socket.on('party:ended', onPartyEnded)
    socket.on('guests:updated', onGuestsUpdated)
    socket.on('playlist:updated', onPlaylistUpdated)
    return () => {
      socketRef.current = null
      setPartySocket(null)
      socket.off('party:state', onStateEnded)
      socket.off('lyrics:error', onLyricErr)
      socket.off('song:finished', onSongFinished)
      socket.off('party:ended', onPartyEnded)
      socket.off('guests:updated', onGuestsUpdated)
      socket.off('playlist:updated', onPlaylistUpdated)
      socket.close()
    }
  }, [data?.partySessionId, partyCode])

  useEffect(() => {
    const q = window.matchMedia('(max-width: 1024px) and (orientation: landscape)')
    const onChange = () => setIsLandscapePhone(q.matches)
    onChange()
    q.addEventListener('change', onChange)
    return () => q.removeEventListener('change', onChange)
  }, [])

  if (!partyCode || !PC.test(partyCode)) {
    return <p className="text-sm text-white/80">Invalid code.</p>
  }

  if (err === 'unauthorized' || err === 'invalid') {
    return (
      <div className="fs-card-lobby mx-auto w-full max-w-md space-y-3 rounded-3xl p-6 text-left" role="alert">
        <p className="text-3xl" aria-hidden>
          🎟️
        </p>
        <h2 className="text-2xl font-black">Get in the door</h2>
        <p className="text-sm text-white/85">
          Join the party from the link or QR first, then you can open this page.
        </p>
        <Link
          to={`/join/${encodeURIComponent(partyCode)}`}
          className="inline-block min-h-12 rounded-2xl bg-fuchsia-500 px-5 py-3 text-sm font-black text-white shadow-lg"
        >
          Open join
        </Link>
      </div>
    )
  }

  if (err && !data) {
    return <p className="text-sm text-rose-100">Could not load lobby ({err}).</p>
  }

  if (partyClosed) {
    return (
      <div className="fs-card-lobby mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center rounded-3xl p-6 text-center">
        <p className="text-4xl" aria-hidden>
          🎤
        </p>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">This party has ended</h1>
        <p className="mt-2 text-balance text-sm text-white/85">
          The host closed the room. Thanks for singing along — you can close this page.
        </p>
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-white/60">Entering the room…</p>
  }

  const isController = String(data.guestId) === String(k?.controller?.id ?? '')

  async function requestControl() {
    if (!partyCode) return
    setReqBusy(true)
    setReqMsg(null)
    try {
      const r = await fetch(
        `/api/party/${encodeURIComponent(partyCode)}/request-control`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }
      )
      if (r.status === 201) {
        setReqMsg('Request sent! The host can approve you as controller when they are ready.')
        return
      }
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      if (d.error === 'no_active_song') {
        setReqMsg('There is no active song right now, or the host is not at the karaoke track yet.')
        return
      }
      if (d.error === 'control_already_pending') {
        setReqMsg('You already have a pending request.')
        return
      }
      setReqMsg('Could not send request. Try again later.')
    } catch {
      setReqMsg('Network error.')
    } finally {
      setReqBusy(false)
    }
  }

  const hasSong = !!k?.activeSong?.id

  const audioVariant: KaraokeAudioVariant = (() => {
    if (
      String(data.guestId) === String(k?.controller?.id ?? '') &&
      k?.controllerAudioEnabled === true
    ) {
      return 'controller'
    }
    return 'lyrics-only'
  })()

  const guestCount = k?.connectedGuestCount ?? 0
  const sess = (k?.sessionStatus || 'active').toLowerCase()
  const lineLang = (data.languagePreference || 'english').toLowerCase() as
    | 'english'
    | 'hindi'
    | 'hebrew'
  const lineDir: 'rtl' | 'ltr' = lineLang === 'hebrew' ? 'rtl' : 'ltr'
  const lineFont = lineLang === 'hindi' ? 'fs-text-hi' : lineLang === 'hebrew' ? 'fs-text-he' : ''
  const lines = Array.isArray(k?.lyricLines) ? k.lyricLines : []
  const lineMap = new Map(lines.map((l) => [l.lineNumber, l]))
  const visibleNums =
    typeof k?.currentLineNumber === 'number'
      ? karaokeVisibleLineNumbers(
          lines.map((l) => l.lineNumber),
          k.currentLineNumber
        )
      : []
  const lyricRows = visibleNums
    .map((n) => ({
      lineNumber: n,
      text: pickLineText(lineMap.get(n), lineLang),
      isCurrent: n === k?.currentLineNumber
    }))
    .filter((r) => !!r.text)

  return (
    <div className="flex min-h-[72dvh] flex-col gap-4 pb-8 text-left sm:min-h-[75dvh] sm:gap-5 md:gap-6">
      <SongFinishedConfetti show={showConfetti} onComplete={() => setShowConfetti(false)} />

      <div className="fs-card-lobby flex flex-col gap-3 rounded-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-white/65">Live party lobby</p>
            <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl md:text-4xl">
              {partyTitle || `Party ${partyCode}`}
            </h1>
            <p className="mt-1 text-sm text-white/85">
              You joined as <span className="font-black text-cyan-200">{data.displayName}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2" aria-label="Room stats">
            <StatusPill kind="sync" className="text-sm">
              {guestCount}/{maxGuests} joined
            </StatusPill>
            {sess && (
              <StatusPill kind="success" className="text-sm capitalize">
                {sess}
              </StatusPill>
            )}
          </div>
        </div>
        {Array.isArray(k?.connectedGuests) && k.connectedGuests.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-white/60">
              Connected singers
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {k.connectedGuests.map((g) => (
                <div
                  key={g.id}
                  className="animate-[popIn_.2s_ease-out] rounded-2xl border border-white/20 bg-white/5 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/30 text-xs font-black text-cyan-100 ring-1 ring-cyan-200/30">
                      {initialsFromName(g.displayName)}
                    </span>
                    <span className="truncate text-sm font-bold text-white">{g.displayName}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {partyCode && <PartyCodeQrCard partyCode={partyCode} />}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-white/85">
            <span className="font-extrabold">Language: </span>
            <span className="font-black capitalize text-amber-100">{lineLang}</span>
          </p>
          {partyCode && (
            <Link
              to={`/party/${encodeURIComponent(partyCode)}/playlist`}
              className="min-h-11 touch-manipulation rounded-2xl bg-white/20 px-4 py-2 text-sm font-extrabold text-white ring-2 ring-white/20 hover:bg-white/30"
            >
              Browse songs
            </Link>
          )}
        </div>
      </div>

      {k?.controller && (
        <p className="text-center text-sm text-fuchsia-100/90 sm:text-left">
          <span className="font-extrabold text-amber-200">On the mic: </span>
          <span className="font-bold text-white">{k.controller.displayName}</span>
          {isController ? <span className="ml-1 text-cyan-200">(you!)</span> : null}
        </p>
      )}

      <div
        data-ui="karaoke"
        className="fs-card-karaoke flex min-h-[38vh] flex-1 flex-col justify-center gap-3 rounded-3xl border-2 p-4 sm:min-h-[40vh] sm:gap-4 sm:p-6 md:p-8"
      >
        {hasSong && (
          <div className="border-b border-white/10 pb-3 sm:pb-4">
            <KaraokeOneDeviceAudio
              variant={audioVariant}
              partyCode={partyCode!}
              activeSong={k?.activeSong ?? null}
              playbackStatus={k?.playbackStatus}
              socket={partySocket}
            />
          </div>
        )}
        {isLandscapePhone ? (
          <div className="space-y-3 text-center" role="status" aria-label="Rotate to portrait">
            <p className="text-4xl" aria-hidden>
              📱
            </p>
            <h2 className="text-2xl font-black text-slate-100">Please rotate your phone to portrait mode.</h2>
            <p className="text-base text-slate-400">Lyrics are optimized for portrait viewing.</p>
          </div>
        ) : hasSong ? (
          <>
            {k?.activeSong?.title && (
              <p className="text-center text-xs font-extrabold uppercase tracking-widest text-fuchsia-300/90 sm:text-left">
                Now performing
              </p>
            )}
            {k?.activeSong?.title ? (
              <h2
                className="text-balance text-center text-xl font-black text-white sm:text-left sm:text-2xl md:text-3xl"
                id="now-playing-title"
              >
                {k.activeSong.title}
              </h2>
            ) : null}
            {lyricRows.length > 0 ? (
              <div className="space-y-2" aria-live="polite" role="status">
                {lyricRows.slice(0, 4).map((row) =>
                  row.isCurrent ? (
                    <p
                      key={row.lineNumber}
                      className={`fs-lyric-hero text-balance text-center sm:text-left ${lineFont}`.trim()}
                      dir={lineDir}
                    >
                      {row.text}
                    </p>
                  ) : (
                    <p
                      key={row.lineNumber}
                      className={`fs-lyric-sub text-balance text-center sm:text-left ${lineFont}`.trim()}
                      dir={lineDir}
                    >
                      {row.text}
                    </p>
                  )
                )}
              </div>
            ) : (
              <p className="fs-lyric-hero text-center sm:text-left">—</p>
            )}
          </>
        ) : (
          <div className="space-y-3 text-center sm:text-left" role="status" aria-label="No active song">
            <p className="text-4xl" aria-hidden>
              🎤
            </p>
            <h2 className="text-2xl font-black text-slate-100 sm:text-3xl">Stage is open</h2>
            <p className="max-w-prose text-base text-slate-400">
              There is no song on the main screen yet.
            </p>
          </div>
        )}
      </div>

      <div className="fs-card-lobby rounded-3xl border-2 border-cyan-300/35 bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/15 p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-lg font-black text-cyan-100">Queued songs</h3>
          <span className="text-xs font-bold text-white/70">Live</span>
        </div>
        {playlistPreview.length === 0 ? (
          <p className="text-sm text-white/80">No songs in queue yet. The host is building the setlist.</p>
        ) : (
          <ul className="space-y-2">
            {playlistPreview.map((item) => (
              <li
                key={item.playlistItemId}
                className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-sm"
              >
                <span className="text-xs font-black text-cyan-200">#{item.position + 1}</span>{' '}
                <span className="font-bold text-white">{item.title}</span>
                {item.status ? (
                  <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold capitalize text-white/90">
                    {item.status}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {lyricErr && (
        <p className="text-sm text-amber-200" role="alert">
          {lyricErr}
        </p>
      )}

      {isController && hasSong && !isLandscapePhone && (
        <div role="group" aria-label="Karaoke line controls">
          <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex max-w-md items-end justify-between px-4">
            <LyricActionButton
              label="← Previous"
              onPress={() => socketRef.current?.emit('lyrics:previous')}
            />
            <LyricActionButton
              label="Next →"
              primary
              onPress={() => socketRef.current?.emit('lyrics:next')}
            />
          </div>
          <div className="fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-xs justify-center px-4">
            <LyricActionButton
              label="Finish Song"
              danger
              onPress={() => socketRef.current?.emit('lyrics:finish')}
            />
          </div>
        </div>
      )}

      {!isController && (
        <div className="fs-card-lobby rounded-3xl border-2 border-dashed border-amber-300/50 bg-gradient-to-r from-amber-400/15 to-fuchsia-500/20 p-5 text-center sm:p-6">
          <p className="text-base font-extrabold text-white sm:text-lg">Request the remote</p>
          <p className="mt-1 text-sm text-white/80">Ask to advance lyrics for the current track</p>
          <button
            type="button"
            className="mt-4 w-full min-h-14 max-w-sm touch-manipulation rounded-2xl border-2 border-amber-200/40 bg-amber-400 py-3.5 text-base font-extrabold text-slate-900 shadow-lg shadow-amber-900/20 active:scale-[0.99] disabled:opacity-50 sm:mx-auto"
            disabled={reqBusy}
            aria-label="Request to control lyrics"
            onClick={() => void requestControl()}
          >
            {reqBusy ? 'Sending…' : 'Request control'}
          </button>
          {reqMsg && <p className="mt-3 text-xs text-amber-100/90">{reqMsg}</p>}
        </div>
      )}

      {isController && (
        <p className="text-center text-xs text-slate-500 sm:text-left">You have lyric control in this room.</p>
      )}
    </div>
  )
}

function LyricActionButton({
  label,
  onPress,
  primary,
  danger
}: {
  label: string
  onPress: () => void
  primary?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      className={[
        'min-h-[52px] rounded-2xl px-4 py-3 text-sm font-bold shadow-lg active:scale-[0.99]',
        primary
          ? 'bg-fuchsia-500 text-white ring-2 ring-fuchsia-300/40'
          : danger
            ? 'border-2 border-rose-400/50 bg-rose-600/80 text-white'
            : 'border-2 border-white/20 bg-white/10 text-white'
      ].join(' ')}
      onClick={() => onPress()}
    >
      {label}
    </button>
  )
}
