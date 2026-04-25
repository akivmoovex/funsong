import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import type { RightsStatus, SongDifficulty, SongStatus } from '@/types/song'

const jsonHeaders = { 'Content-Type': 'application/json' }

const STATUSES: SongStatus[] = ['draft', 'published', 'disabled']
const RIGHTS: RightsStatus[] = [
  'private_instrumental',
  'owned_by_app',
  'permission_pending',
  'licensed',
  'blocked'
]
const DIFFS: (SongDifficulty | '')[] = ['', 'easy', 'medium', 'hard', 'expert']

type FormState = {
  title: string
  movieName: string
  originalArtist: string
  composer: string
  lyricist: string
  year: string
  durationSeconds: string
  difficulty: string
  status: SongStatus
  rightsStatus: RightsStatus
  isDefaultSuggestion: boolean
  tags: string
}

const empty: FormState = {
  title: '',
  movieName: '',
  originalArtist: '',
  composer: '',
  lyricist: '',
  year: '',
  durationSeconds: '',
  difficulty: '',
  status: 'draft',
  rightsStatus: 'private_instrumental',
  isDefaultSuggestion: false,
  tags: ''
}

export function AdminSongFormPage() {
  const { songId } = useParams()
  const isNew = !songId
  const nav = useNavigate()
  const [f, setF] = useState<FormState>(empty)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [audioFileUrl, setAudioFileUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew || !songId) {
      setLoading(false)
      return
    }
    let cancel = false
    void (async () => {
      setLoading(true)
      setError(null)
      const r = await fetch(`/api/admin/songs/${songId}`, { credentials: 'include' })
      if (cancel) return
      if (!r.ok) {
        setError('Could not load song.')
        setLoading(false)
        return
      }
      const j = (await r.json()) as { song: import('@/types/song').Song }
      const s = j.song
      setF({
        title: s.title,
        movieName: s.movieName ?? '',
        originalArtist: s.originalArtist ?? '',
        composer: s.composer ?? '',
        lyricist: s.lyricist ?? '',
        year: s.year != null ? String(s.year) : '',
        durationSeconds:
          s.durationSeconds != null ? String(s.durationSeconds) : '',
        difficulty: s.difficulty ?? '',
        status: s.status,
        rightsStatus: s.rightsStatus,
        isDefaultSuggestion: s.isDefaultSuggestion,
        tags: s.tags?.length ? s.tags.join('\n') : ''
      })
      setAudioFileUrl(s.audioFileUrl ?? null)
      setLoading(false)
    })()
    return () => {
      cancel = true
    }
  }, [isNew, songId])

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setF((prev) => ({ ...prev, [k]: v }))
  }

  function parseTags(s: string) {
    return s
      .split(/[\n,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
  }

  async function onAudioFile(t: { files: FileList | null } | null) {
    if (!songId) return
    const file = t?.files?.[0]
    if (!file) return
    setAudioError(null)
    setUploading(true)
    const fd = new FormData()
    fd.set('file', file)
    const r = await fetch(`/api/admin/songs/${songId}/audio`, {
      method: 'POST',
      credentials: 'include',
      body: fd
    })
    setUploading(false)
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setAudioError(j.error || 'Upload failed.')
      return
    }
    const j = (await r.json()) as { song: { audioFileUrl: string | null } }
    setAudioFileUrl(j.song?.audioFileUrl ?? null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!f.title.trim()) {
      setError('Title is required.')
      return
    }
    setSaving(true)
    const body: Record<string, unknown> = {
      title: f.title.trim(),
      movieName: f.movieName || null,
      originalArtist: f.originalArtist || null,
      composer: f.composer || null,
      lyricist: f.lyricist || null,
      year: f.year === '' ? null : Number(f.year),
      durationSeconds: f.durationSeconds === '' ? null : Number(f.durationSeconds),
      difficulty: f.difficulty || null,
      status: f.status,
      rightsStatus: f.rightsStatus,
      isDefaultSuggestion: f.isDefaultSuggestion,
      tags: parseTags(f.tags)
    }
    const url = isNew ? '/api/admin/songs' : `/api/admin/songs/${songId}`
    const r = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: jsonHeaders,
      body: JSON.stringify(body)
    })
    setSaving(false)
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setError(j.error || 'Save failed.')
      return
    }
    if (isNew) {
      const j = (await r.json()) as { song: { id: string } }
      nav(`/admin/songs/${j.song.id}/edit`, { replace: true })
    } else {
      nav('/admin/songs', { replace: true })
    }
  }

  if (loading) {
    return <p className="text-sm font-bold text-white/80">Loading…</p>
  }

  return (
    <div className="max-w-lg space-y-4 text-left text-white">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-widest text-amber-200/90">
          {isNew ? 'New song' : 'Edit song'}
        </p>
        <h1 className="text-2xl font-black">
          {isNew ? 'Add to library' : f.title}
        </h1>
        {!isNew && songId && (
          <p className="mt-2">
            <Link
              to={`/admin/songs/${songId}/lyrics`}
              className="text-sm font-extrabold text-cyan-200 underline"
            >
              Edit lyrics (English, Hindi, Hebrew) →
            </Link>
          </p>
        )}
      </div>

      {error && (
        <div
          className="rounded-2xl border-2 border-rose-300/50 bg-rose-500/20 p-3 text-sm font-extrabold"
          role="alert"
        >
          {error}
        </div>
      )}

      {!isNew && songId && (
        <div className="fs-card-lobby space-y-3 text-sm">
          <p className="text-xs font-extrabold uppercase tracking-widest text-amber-100/90">
            MP3 audio
          </p>
          <p className="text-white/80">
            Upload a track (MP3 / audio/mpeg). Replaces the previous file. Files
            are not exposed as public download links; playback uses your session
            in this app.
          </p>
          {audioError && (
            <p className="text-sm font-bold text-rose-200" role="alert">
              {audioError}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,.mp3"
              disabled={uploading}
              onChange={(e) => void onAudioFile(e.target)}
              className="min-h-12 w-full touch-manipulation text-sm text-white file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-lime-400 file:px-3 file:font-extrabold file:text-slate-900"
            />
            {uploading && (
              <span className="text-xs font-bold text-white/80">Uploading…</span>
            )}
          </div>
          {audioFileUrl && (
            <div className="rounded-2xl border-2 border-white/20 bg-slate-900/40 p-3">
              <p className="mb-2 text-xs font-extrabold text-lime-100/90">Preview</p>
              <audio
                className="w-full"
                src={audioFileUrl}
                controls
                controlsList="nodownload noremoteplayback"
                preload="metadata"
              />
            </div>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="fs-card-lobby space-y-4 text-sm">
        <div>
          <label className="mb-1 block text-xs font-extrabold uppercase text-lime-100/90">
            Title *
          </label>
          <input
            required
            className="w-full min-h-12 touch-manipulation rounded-2xl border-2 border-white/25 bg-slate-900/30 px-3 text-base font-bold text-white placeholder-white/50 focus:border-amber-200 focus:outline-none"
            value={f.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Track title"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-extrabold uppercase text-cyan-100/90">
            Movie / show
          </label>
          <input
            className="w-full min-h-12 touch-manipulation rounded-2xl border-2 border-white/25 bg-slate-900/30 px-3 text-base text-white"
            value={f.movieName}
            onChange={(e) => set('movieName', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-extrabold uppercase text-fuchsia-100/90">
              Original artist
            </label>
            <input
              className="w-full min-h-12 touch-manipulation rounded-2xl border-2 border-white/25 bg-slate-900/30 px-3 text-base text-white"
              value={f.originalArtist}
              onChange={(e) => set('originalArtist', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-extrabold uppercase text-fuchsia-100/90">
              Composer
            </label>
            <input
              className="w-full min-h-12 touch-manipulation rounded-2xl border-2 border-white/25 bg-slate-900/30 px-3 text-base text-white"
              value={f.composer}
              onChange={(e) => set('composer', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-extrabold uppercase text-violet-200/90">
            Lyricist
          </label>
          <input
            className="w-full min-h-12 touch-manipulation rounded-2xl border-2 border-white/25 bg-slate-900/30 px-3 text-base text-white"
            value={f.lyricist}
            onChange={(e) => set('lyricist', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-extrabold uppercase text-amber-200/90">
              Year
            </label>
            <input
              type="number"
              min={1000}
              max={3000}
              className="w-full min-h-12 touch-manipulation rounded-2xl border-2 border-white/25 bg-slate-900/30 px-3 text-base text-white"
              value={f.year}
              onChange={(e) => set('year', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-extrabold uppercase text-amber-200/90">
              Duration (sec)
            </label>
            <input
              type="number"
              min={0}
              className="w-full min-h-12 touch-manipulation rounded-2xl border-2 border-white/25 bg-slate-900/30 px-3 text-base text-white"
              value={f.durationSeconds}
              onChange={(e) => set('durationSeconds', e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-extrabold uppercase text-lime-100/90">
              Status
            </label>
            <select
              className="w-full min-h-12 touch-manipulation rounded-2xl border-2 border-white/25 bg-slate-900/30 px-2 text-base font-bold text-white"
              value={f.status}
              onChange={(e) => set('status', e.target.value as SongStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-extrabold uppercase text-lime-100/90">
              Rights
            </label>
            <select
              className="w-full min-h-12 touch-manipulation rounded-2xl border-2 border-white/25 bg-slate-900/30 px-2 text-base font-bold text-white"
              value={f.rightsStatus}
              onChange={(e) => set('rightsStatus', e.target.value as RightsStatus)}
            >
              {RIGHTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-extrabold uppercase text-cyan-100/90">
            Difficulty
          </label>
          <select
            className="w-full min-h-12 touch-manipulation rounded-2xl border-2 border-white/25 bg-slate-900/30 px-2 text-base font-bold text-white"
            value={f.difficulty}
            onChange={(e) => set('difficulty', e.target.value)}
          >
            {DIFFS.map((d) => (
              <option key={d || 'empty'} value={d}>
                {d || '— not set —'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="sug"
            type="checkbox"
            className="h-5 w-5 touch-manipulation rounded border-2 border-amber-200/80"
            checked={f.isDefaultSuggestion}
            onChange={(e) => set('isDefaultSuggestion', e.target.checked)}
          />
          <label htmlFor="sug" className="text-sm font-extrabold text-amber-100">
            Suggest in party browser
          </label>
        </div>
        <div>
          <label className="mb-1 block text-xs font-extrabold uppercase text-fuchsia-100/90">
            Tags (one per line or comma-separated)
          </label>
          <textarea
            rows={3}
            className="w-full touch-manipulation rounded-2xl border-2 border-white/25 bg-slate-900/30 px-3 py-2 text-base text-white"
            value={f.tags}
            onChange={(e) => set('tags', e.target.value)}
            placeholder="bollywood, 90s"
          />
        </div>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
          <Button
            type="submit"
            disabled={saving}
            className="w-full min-w-0 sm:w-auto"
          >
            {saving ? 'Saving…' : isNew ? 'Create song' : 'Save changes'}
          </Button>
          <Button to="/admin/songs" variant="ghost-lobby" className="!min-h-12 w-full sm:w-auto">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
