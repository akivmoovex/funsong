import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { createPartySocket } from '../realtime/partySocket'
import { StatusPill } from '../components/ui/StatusPill'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PartyRequest = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  partyName: string
  eventDatetime: string | null
  expectedGuests: number | null
  description: string | null
  rejectionReason: string | null
  joinPath: string | null
  joinUrl: string | null
  partyCode: string | null
  canShowJoinLink: boolean
  canShowQr: boolean
  /** From `party_sessions` when the request is approved */
  sessionStatus?: string | null
  endedAt?: string | null
}

type PlaylistPreview = {
  playlistItemId: string
  position: number
  title: string
  difficulty: string | null
}

type HostPartyState = {
  activeSong?: { id: string; title?: string } | null
  connectedGuestCount?: number
  connectedGuests?: Array<{ id: string; displayName: string }>
  sessionStatus?: string
}

function initialsFromName(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function HostPartyDetailPage() {
  const { partyId } = useParams()
  const [row, setRow] = useState<PartyRequest | null>(null)
  const [partySessionId, setPartySessionId] = useState<string | null>(null)
  const [connectedGuestCount, setConnectedGuestCount] = useState(0)
  const [connectedGuests, setConnectedGuests] = useState<Array<{ id: string; displayName: string }>>([])
  const [activeSongTitle, setActiveSongTitle] = useState<string | null>(null)
  const [playlistPreview, setPlaylistPreview] = useState<PlaylistPreview[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!partyId || !UUID_RE.test(partyId)) {
      setErr('invalid_id')
      return
    }
    let cancel = false
    void (async () => {
      try {
        const r = await fetch(`/api/host/party-requests/${partyId}`, {
          credentials: 'include'
        })
        const d = (await r.json().catch(() => ({}))) as { partyRequest?: PartyRequest; error?: string }
        if (r.status === 404) {
          if (!cancel) setErr('not_found')
          return
        }
        if (!r.ok) {
          if (!cancel) setErr(d.error || 'load_failed')
          return
        }
        if (d.partyRequest && !cancel) {
          setRow(d.partyRequest)
          setPartySessionId(null)
          setConnectedGuestCount(0)
          setConnectedGuests([])
          setActiveSongTitle(null)
          if (d.partyRequest.status === 'approved' && d.partyRequest.sessionStatus !== 'ended') {
            const rp = await fetch(`/api/host/parties/${partyId}/playlist`, {
              credentials: 'include'
            })
            const dp = (await rp.json().catch(() => ({}))) as {
              partySessionId?: string
              playlist?: PlaylistPreview[]
            }
            if (rp.ok) {
              setPartySessionId(dp.partySessionId || null)
              setPlaylistPreview(Array.isArray(dp.playlist) ? dp.playlist.slice(0, 4) : [])
            } else {
              setPlaylistPreview([])
            }
          } else {
            setPlaylistPreview([])
          }
          setErr(null)
        }
      } catch {
        if (!cancel) setErr('network')
      }
    })()
    return () => {
      cancel = true
    }
  }, [partyId])

  useEffect(() => {
    if (!partySessionId) return
    const socket = createPartySocket({
      partySessionId,
      role: 'host',
      withCredentials: true
    })
    const onPartyState = (s: HostPartyState) => {
      setConnectedGuestCount(typeof s.connectedGuestCount === 'number' ? s.connectedGuestCount : 0)
      setConnectedGuests(Array.isArray(s.connectedGuests) ? s.connectedGuests : [])
      setActiveSongTitle(s.activeSong?.title || null)
    }
    const onGuestsUpdated = (p: {
      connectedGuestCount?: number
      connectedGuests?: Array<{ id: string; displayName: string }>
    }) => {
      if (typeof p.connectedGuestCount === 'number') {
        setConnectedGuestCount(p.connectedGuestCount)
      }
      if (Array.isArray(p.connectedGuests)) {
        setConnectedGuests(p.connectedGuests)
      }
    }
    const onPlaylistUpdated = async () => {
      if (!partyId) return
      const rp = await fetch(`/api/host/parties/${partyId}/playlist`, {
        credentials: 'include'
      })
      const dp = (await rp.json().catch(() => ({}))) as {
        playlist?: PlaylistPreview[]
      }
      if (rp.ok) {
        setPlaylistPreview(Array.isArray(dp.playlist) ? dp.playlist.slice(0, 4) : [])
      }
    }
    socket.on('party:state', onPartyState)
    socket.on('guests:updated', onGuestsUpdated)
    socket.on('playlist:updated', onPlaylistUpdated)
    return () => {
      socket.off('party:state', onPartyState)
      socket.off('guests:updated', onGuestsUpdated)
      socket.off('playlist:updated', onPlaylistUpdated)
      socket.close()
    }
  }, [partyId, partySessionId])

  if (!partyId || !UUID_RE.test(partyId)) {
    return (
      <div className="fs-card text-left text-sm text-white/80">Invalid party id.</div>
    )
  }

  if (err === 'not_found' || err === 'invalid_id') {
    return (
      <div className="fs-card space-y-3 text-left">
        <p className="text-sm text-white/80">We could not find that party request.</p>
        <Link to="/host/dashboard" className="font-bold text-fuchsia-300 hover:text-fuchsia-200">
          Back to dashboard
        </Link>
      </div>
    )
  }

  if (err && !row) {
    return (
      <div className="fs-card text-left text-sm text-rose-100">Could not load this party ({err}).</div>
    )
  }

  if (!row) {
    return (
      <div className="fs-card text-center text-sm text-white/80">Loading…</div>
    )
  }

  const shareUrl = row.joinUrl
    ? row.joinUrl
    : row.joinPath
      ? `${window.location.origin}${row.joinPath}`
      : null

  return (
    <div className="fs-card max-w-3xl space-y-4 text-left">
      {row.sessionStatus === 'ended' && (
        <div
          className="rounded-2xl border border-slate-400/40 bg-slate-500/20 px-4 py-3 text-sm text-white/95"
          role="status"
        >
          <p className="font-extrabold">This party has ended</p>
          {row.endedAt ? (
            <p className="mt-1 text-white/80">
              Ended {new Date(row.endedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          ) : null}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-black">{row.partyName}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {row.status === 'approved' && row.canShowJoinLink && row.sessionStatus !== 'ended' && (
            <Link
              to={`/host/parties/${partyId}/playlist`}
              className="text-sm font-bold text-amber-200 hover:text-amber-100"
            >
              Edit playlist
            </Link>
          )}
          <Link
            to="/host/dashboard"
            className="text-sm font-bold text-fuchsia-300 hover:text-fuchsia-200"
          >
            Dashboard
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusPill kind="sync" icon={<span>👥</span>}>
          {connectedGuestCount} connected
        </StatusPill>
        <StatusPill kind={activeSongTitle ? 'success' : 'warning'}>
          {activeSongTitle ? 'Party live' : 'Waiting to start'}
        </StatusPill>
      </div>
      {connectedGuests.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {connectedGuests.map((g) => (
            <div
              key={g.id}
              className="animate-[popIn_.2s_ease-out] rounded-2xl border border-white/20 bg-white/10 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-500/35 text-xs font-black text-fuchsia-100 ring-1 ring-fuchsia-200/40">
                  {initialsFromName(g.displayName)}
                </span>
                <span className="truncate text-sm font-bold text-white">{g.displayName}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-3 text-sm text-white/75">
          No guests yet. Share the QR to start the party lobby.
        </div>
      )}
      <p className="text-sm text-white/80">
        <span
          className={
            row.status === 'approved'
              ? 'text-emerald-300'
              : row.status === 'rejected'
                ? 'text-rose-200'
                : 'text-amber-200'
          }
        >
          Status: {row.status}
        </span>
        {' · '}
        {formatWhen(row.eventDatetime)}
      </p>
      {row.description ? (
        <p className="whitespace-pre-wrap text-sm text-white/90">{row.description}</p>
      ) : null}
      {row.status === 'rejected' && row.rejectionReason ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-50">
          <span className="font-bold">Reason: </span>
          {row.rejectionReason}
        </div>
      ) : null}
      {row.status === 'pending' && (
        <p className="text-sm text-white/70">
          This party is still being prepared. Join link and guest QR are not available yet.
        </p>
      )}
      {row.status === 'rejected' && !row.rejectionReason && (
        <p className="text-sm text-white/70">This request was rejected. No share link is available.</p>
      )}
      {row.status === 'approved' && !row.canShowJoinLink && (
        <p className="text-sm text-white/70">
          Your request is approved, but a join room is not ready yet. Check back
          shortly for your link and QR.
        </p>
      )}
      {row.status === 'approved' && row.canShowJoinLink && shareUrl && (
        <div className="space-y-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <p className="text-sm font-bold text-emerald-100">Guest join link</p>
          <p className="text-xs text-white/60">Public code: {row.partyCode ?? '—'}</p>
          <input
            readOnly
            value={shareUrl}
            className="w-full select-all rounded-2xl border-2 border-white/20 bg-white/10 px-3 py-2 text-xs text-white"
            aria-label="Join link for guests"
          />
          {row.canShowQr ? (
            <>
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-start sm:gap-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-2xl bg-white p-3">
                    <QRCode value={shareUrl} size={160} />
                  </div>
                  <p className="text-center text-xs text-white/70 sm:text-left">
                    Guests can scan to open the join page
                  </p>
                </div>
                <Link
                  to={`/host/parties/${partyId}/qr`}
                  className="text-sm font-bold text-emerald-200 underline hover:text-white"
                >
                  Open full-size QR
                </Link>
              </div>
            </>
          ) : null}
        </div>
      )}
      <div className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-black text-cyan-100">Playlist preview</p>
          {row.status === 'approved' && row.canShowJoinLink && row.sessionStatus !== 'ended' && (
            <Link to={`/host/parties/${partyId}/playlist`} className="text-xs font-bold text-cyan-200 underline">
              Open full playlist
            </Link>
          )}
        </div>
        {playlistPreview.length === 0 ? (
          <p className="text-sm text-white/75">No songs yet. Add songs before you start.</p>
        ) : (
          <ul className="space-y-2">
            {playlistPreview.map((p) => (
              <li key={p.playlistItemId} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                <span className="text-xs font-black text-cyan-100">#{p.position + 1}</span>{' '}
                <span className="font-bold text-white">{p.title}</span>
                {p.difficulty ? (
                  <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white/90">
                    {p.difficulty}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
