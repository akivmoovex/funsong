import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type FavSong = {
  id: string
  title: string
  difficulty: string | null
  tags: string[]
  audioReady: boolean
  lyricsReady: boolean
}

export function MySongsPage() {
  const [songs, setSongs] = useState<FavSong[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    const r = await fetch('/api/account/my-songs', { credentials: 'include' })
    const d = (await r.json().catch(() => ({}))) as { songs?: FavSong[] }
    if (!r.ok) {
      setErr('load')
      return
    }
    setSongs(Array.isArray(d.songs) ? d.songs : [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(songId: string) {
    setBusyId(songId)
    setErr(null)
    try {
      const r = await fetch(`/api/account/my-songs/${encodeURIComponent(songId)}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!r.ok) {
        setErr('remove')
        return
      }
      setSongs((prev) => (prev || []).filter((s) => s.id !== songId))
    } catch {
      setErr('network')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 text-left">
      <div className="fs-card rounded-3xl p-5">
        <h1 className="text-2xl font-black text-amber-100 sm:text-3xl">My Songs</h1>
        <p className="mt-2 text-sm text-white/80">
          Your personal favorites list. Practice without creating a party.
        </p>
      </div>
      {err && (
        <p className="text-sm text-rose-100">
          {err === 'load' && 'Could not load your favorites.'}
          {err === 'remove' && 'Could not remove this favorite right now.'}
          {err === 'network' && 'Network error. Try again.'}
        </p>
      )}
      {!songs && <p className="text-sm text-white/70">Loading your songs...</p>}
      {songs && songs.length === 0 && (
        <div className="fs-card rounded-3xl p-8 text-center">
          <p className="text-4xl" aria-hidden>
            🎵
          </p>
          <h2 className="mt-2 text-xl font-black text-white">No favorites yet</h2>
          <p className="mt-1 text-sm text-white/75">
            Add songs to favorites from the host song cards, then come back here to practice.
          </p>
        </div>
      )}
      {songs && songs.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {songs.map((s) => (
            <li key={s.id} className="fs-card rounded-3xl p-4">
              <h3 className="text-lg font-black text-white">{s.title}</h3>
              {s.difficulty && (
                <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-amber-200">
                  {s.difficulty}
                </p>
              )}
              {s.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-bold text-cyan-100"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span
                  className={`rounded-full px-2.5 py-0.5 font-extrabold ${s.audioReady ? 'bg-emerald-500/40 text-emerald-100' : 'bg-white/10 text-white/55'}`}
                >
                  Audio {s.audioReady ? 'ready' : 'missing'}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-extrabold ${s.lyricsReady ? 'bg-sky-500/40 text-sky-100' : 'bg-white/10 text-white/55'}`}
                >
                  Lyrics {s.lyricsReady ? 'ready' : 'missing'}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2">
                <Link
                  to={`/my-songs/practice/${encodeURIComponent(s.id)}`}
                  className="min-h-11 rounded-2xl bg-fuchsia-500 px-4 py-2 text-center text-sm font-extrabold text-white"
                >
                  Play / Practice
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(s.id)}
                  disabled={busyId === s.id}
                  className="min-h-11 rounded-2xl border border-rose-300/40 bg-rose-500/20 px-4 py-2 text-sm font-extrabold text-rose-100 disabled:opacity-50"
                >
                  {busyId === s.id ? 'Removing...' : 'Remove from My Songs'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
