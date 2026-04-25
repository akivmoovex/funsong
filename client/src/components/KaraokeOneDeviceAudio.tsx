import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'

type Active = {
  id: string
  title?: string
  audioFileUrl?: string | null
}

export type KaraokeAudioVariant = 'host' | 'controller' | 'lyrics-only'

type Props = {
  variant: KaraokeAudioVariant
  /** Party join code; required for `controller` stream URL. */
  partyCode?: string
  /** Party request id from route; required for `host` pause/resume API. */
  partyRequestId?: string
  activeSong: Active | null
  playbackStatus?: string
  /** Guest socket; used for `controller` pause/resume. */
  socket?: Socket | null
}

/**
 * One-device rule: only `host` and `controller` variants show an audio element and controls.
 * `lyrics-only` (normal guests) renders nothing — no autoplay, no hidden audio.
 */
export function KaraokeOneDeviceAudio({
  variant,
  partyCode,
  partyRequestId,
  activeSong,
  playbackStatus = 'idle',
  socket
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [hasUserStarted, setHasUserStarted] = useState(false)

  const isPlayback = variant === 'host' || variant === 'controller'
  const hasAudioFile = Boolean(activeSong?.audioFileUrl)

  const src =
    isPlayback && hasAudioFile && activeSong
      ? variant === 'host'
        ? (activeSong.audioFileUrl as string)
        : partyCode
          ? `/api/party/${encodeURIComponent(partyCode)}/active-song-audio`
          : null
      : null

  const syncPauseToServer = useCallback(async () => {
    if (variant === 'host' && partyRequestId) {
      const r = await fetch(`/api/host/parties/${encodeURIComponent(partyRequestId)}/pause-song`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!r.ok) {
        setErr('Could not sync pause.')
      }
      return
    }
    if (variant === 'controller' && socket) {
      socket.emit('audio:pause')
    }
  }, [variant, partyRequestId, socket])

  const syncResumeToServer = useCallback(async () => {
    if (variant === 'host' && partyRequestId) {
      const r = await fetch(`/api/host/parties/${encodeURIComponent(partyRequestId)}/resume-song`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!r.ok) {
        setErr('Could not sync play.')
      }
      return
    }
    if (variant === 'controller' && socket) {
      socket.emit('audio:resume')
    }
  }, [variant, partyRequestId, socket])

  const onPlayClick = useCallback(async () => {
    const el = audioRef.current
    if (!el || !src) return
    setErr(null)
    setHasUserStarted(true)
    try {
      if (playbackStatus === 'paused') {
        await syncResumeToServer()
      }
      await el.play()
    } catch {
      setErr('Playback was blocked. Tap play again (mobile browsers need a direct tap).')
    }
  }, [playbackStatus, src, syncResumeToServer])

  const onPauseClick = useCallback(async () => {
    const el = audioRef.current
    if (!el) return
    el.pause()
    setErr(null)
    if (playbackStatus === 'playing') {
      await syncPauseToServer()
    }
  }, [playbackStatus, syncPauseToServer])

  const onRestartClick = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = 0
  }, [])

  useEffect(() => {
    const el = audioRef.current
    if (el) {
      el.currentTime = 0
    }
  }, [activeSong?.id])

  useEffect(() => {
    const s = socket
    if (variant !== 'controller' || !s) {
      return
    }
    const onE = (e: { error?: string }) => {
      if (e?.error) {
        setErr(`Audio sync: ${e.error}`)
      }
    }
    s.on('audio:error', onE)
    return () => {
      s.off('audio:error', onE)
    }
  }, [socket, variant])

  if (!isPlayback) {
    return null
  }

  if (!activeSong?.id) {
    return null
  }

  if (!hasAudioFile || !src) {
    return (
      <div
        className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/70"
        data-testid="karaoke-audio-empty"
        aria-label="No instrumental audio for this track"
      >
        <p className="font-bold text-amber-100/90">No MP3 for this track</p>
        <p className="mt-1 text-xs text-white/50">Lyrics still work. Add audio in the song library when you are on the main screen.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2" data-testid="karaoke-audio-block">
      <p
        className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-50/95"
        role="status"
      >
        <span className="text-lg" aria-hidden>
          🔊
        </span>
        <span>
          <strong>One device:</strong> use a single phone or browser tab for playback to avoid echo.
        </span>
      </p>

      {err && <p className="text-xs text-rose-200">{err}</p>}

      {/* No native `controls` — avoids browser download UI. Hidden element for Web Audio API. */}
      <audio
        ref={audioRef}
        preload="none"
        src={src}
        className="hidden"
        data-testid="karaoke-audio"
        playsInline
        controls={false}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-[48px] min-w-[6rem] rounded-2xl bg-fuchsia-500 px-4 py-2 text-sm font-bold text-white"
          onClick={() => void onPlayClick()}
          aria-label="Play instrumental"
        >
          Play
        </button>
        <button
          type="button"
          className="min-h-[48px] min-w-[6rem] rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white"
          onClick={() => void onPauseClick()}
          aria-label="Pause instrumental"
        >
          Pause
        </button>
        <button
          type="button"
          className="min-h-[48px] min-w-[6rem] rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white"
          onClick={onRestartClick}
          aria-label="Restart track from the beginning"
        >
          Restart
        </button>
      </div>

      {!hasUserStarted && (
        <p className="text-xs text-white/50">Tap Play to start — we do not autoplay before you interact (mobile safe).</p>
      )}
    </div>
  )
}
