import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Song, SongStatus } from '@/types/song'

const jsonHeaders = { 'Content-Type': 'application/json' }

const statusColor = (s: SongStatus) =>
  s === 'published' ? 'emerald' : s === 'disabled' ? 'rose' : 'violet'

export function AdminSongsListPage() {
  const [songs, setSongs] = useState<Song[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const r = await fetch('/api/admin/songs', { credentials: 'include' })
    if (!r.ok) {
      setError('Could not load songs.')
      setLoading(false)
      return
    }
    const j = (await r.json()) as { songs: Song[] }
    setSongs(j.songs)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function doPublish(id: string) {
    setActionId(id)
    setError(null)
    const r = await fetch(`/api/admin/songs/${id}/publish`, {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders
    })
    setActionId(null)
    if (!r.ok) {
      setError('Publish failed.')
      return
    }
    void load()
  }

  async function doDisable(id: string) {
    setActionId(id)
    setError(null)
    const r = await fetch(`/api/admin/songs/${id}/disable`, {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders
    })
    setActionId(null)
    if (!r.ok) {
      setError('Disable failed.')
      return
    }
    void load()
  }

  return (
    <div className="space-y-5 text-left text-white">
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-amber-200/90">
            Super admin
          </p>
          <h1 className="text-2xl font-black sm:text-3xl">Song library</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to="/admin/songs/new"
            className="fs-button fs-button--lime inline-block text-center no-underline"
          >
            + New song
          </Link>
          <Link
            to="/admin"
            className="fs-button inline-block border-2 border-white/30 bg-white/10 text-center no-underline"
          >
            Back to admin
          </Link>
        </div>
      </div>

      {error && (
        <div
          className="rounded-2xl border-2 border-rose-300/50 bg-rose-500/20 p-3 text-sm font-extrabold"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && (
        <p className="text-sm font-bold text-white/80">Loading…</p>
      )}

      {!loading && songs.length === 0 && (
        <div className="fs-card-lobby text-center">
          <p className="font-bold">No songs yet. Create the first one.</p>
        </div>
      )}

      <ul className="space-y-3">
        {songs.map((s) => (
          <li
            key={s.id}
            className="fs-card-lobby border-l-4 border-amber-300/80 pl-1"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-black text-white drop-shadow">
                    {s.title}
                  </span>
                  <Badge flavor={statusColor(s.status)}>{s.status}</Badge>
                  <Badge flavor="fuchsia" className="!text-xs">
                    {s.rightsStatus}
                  </Badge>
                  {s.isDefaultSuggestion && (
                    <Badge flavor="amber">suggested</Badge>
                  )}
                </div>
                {s.movieName && (
                  <p className="mt-1 text-sm text-white/85">Movie: {s.movieName}</p>
                )}
                {s.tags?.length > 0 && (
                  <p className="mt-2 text-xs text-lime-100/90">
                    Tags: {s.tags.join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:min-w-[8rem]">
                <Button
                  to={`/admin/songs/${s.id}/edit`}
                  variant="ghost-lobby"
                  size="sm"
                  className="!min-h-11"
                >
                  Edit
                </Button>
                <Button
                  to={`/admin/songs/${s.id}/lyrics`}
                  variant="ghost-lobby"
                  size="sm"
                  className="!min-h-11 border-2 !border-cyan-400/40"
                >
                  Lyrics
                </Button>
                {s.status !== 'published' && (
                  <Button
                    type="button"
                    onClick={() => doPublish(s.id)}
                    disabled={actionId === s.id}
                    className="fs-button fs-button--lime !min-h-11 w-full"
                  >
                    Publish
                  </Button>
                )}
                {s.status !== 'disabled' && (
                  <button
                    type="button"
                    onClick={() => doDisable(s.id)}
                    disabled={actionId === s.id}
                    className="fs-button min-h-11 w-full rounded-2xl border-2 border-rose-400/50 bg-rose-500/30 text-base font-extrabold text-rose-50 shadow transition hover:bg-rose-500/50 disabled:opacity-50"
                  >
                    Disable
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
