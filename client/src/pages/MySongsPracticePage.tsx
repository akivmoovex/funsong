import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { KaraokeOneDeviceAudio } from '../components/KaraokeOneDeviceAudio'
import { karaokeVisibleLineNumbers } from '../lib/lyricPreview'
import { pickLineText } from '../lib/lyricText'

type PracticeLine = {
  lineNumber: number
  textEnglish?: string
  textHindi?: string
  textHebrew?: string
}

type PracticeSong = {
  id: string
  title: string
  audioFileUrl?: string | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function MySongsPracticePage() {
  const { songId } = useParams()
  const [song, setSong] = useState<PracticeSong | null>(null)
  const [lines, setLines] = useState<PracticeLine[]>([])
  const [lang, setLang] = useState<'english' | 'hindi' | 'hebrew'>('english')
  const [currentLineNumber, setCurrentLineNumber] = useState<number | null>(null)
  const [lineMode, setLineMode] = useState<2 | 4>(4)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!songId || !UUID_RE.test(songId)) {
      setErr('invalid')
      return
    }
    let cancelled = false
    void (async () => {
      const r = await fetch(`/api/account/my-songs/${encodeURIComponent(songId)}/practice`, {
        credentials: 'include'
      })
      const d = (await r.json().catch(() => ({}))) as {
        song?: { id: string; title: string; audioFileUrl?: string | null }
        lines?: PracticeLine[]
        error?: string
      }
      if (!r.ok) {
        if (!cancelled) setErr(d.error || 'load')
        return
      }
      if (!cancelled) {
        setSong({
          id: String(d.song?.id || ''),
          title: String(d.song?.title || 'Song'),
          audioFileUrl: d.song?.audioFileUrl || null
        })
        const out = Array.isArray(d.lines) ? d.lines : []
        setLines(out)
        setCurrentLineNumber(out[0]?.lineNumber ?? null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [songId])

  const sortedNumbers = useMemo(
    () => [...new Set(lines.map((l) => l.lineNumber))].sort((a, b) => a - b),
    [lines]
  )
  const currentIndex = currentLineNumber == null ? -1 : sortedNumbers.indexOf(currentLineNumber)
  const lineMap = useMemo(() => new Map(lines.map((l) => [l.lineNumber, l])), [lines])
  const visibleNums =
    currentLineNumber == null ? [] : karaokeVisibleLineNumbers(sortedNumbers, currentLineNumber)
  const rows = (lineMode === 2 ? visibleNums.slice(0, 2) : visibleNums)
    .map((n) => ({
      lineNumber: n,
      text: pickLineText(lineMap.get(n), lang),
      isCurrent: n === currentLineNumber
    }))
    .filter((r) => !!r.text)

  function step(dir: -1 | 1) {
    if (currentIndex < 0) return
    const n = sortedNumbers[currentIndex + dir]
    if (typeof n === 'number') setCurrentLineNumber(n)
  }

  if (err === 'invalid') {
    return <p className="text-sm text-white/80">Invalid song id.</p>
  }
  if (err === 'not_favorite') {
    return (
      <div className="fs-card rounded-3xl p-6">
        <h1 className="text-xl font-black text-amber-100">This song is not in your favorites</h1>
        <p className="mt-2 text-sm text-white/80">Add it to My Songs first, then open practice mode.</p>
        <Link to="/my-songs" className="mt-4 inline-block rounded-2xl bg-fuchsia-500 px-4 py-2 text-sm font-extrabold text-white">
          Back to My Songs
        </Link>
      </div>
    )
  }
  if (err) {
    return <p className="text-sm text-rose-100">Could not load practice mode ({err}).</p>
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 text-left">
      <div className="fs-card rounded-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-white/65">Practice mode</p>
            <h1 className="text-2xl font-black text-white sm:text-3xl">{song?.title || 'Loading...'}</h1>
          </div>
          <Link to="/my-songs" className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-extrabold text-white">
            Back to My Songs
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-2xl px-3 py-1.5 text-xs font-extrabold ${lineMode === 2 ? 'bg-cyan-500 text-white' : 'bg-white/10 text-white/80'}`}
            onClick={() => setLineMode(2)}
          >
            2-line
          </button>
          <button
            type="button"
            className={`rounded-2xl px-3 py-1.5 text-xs font-extrabold ${lineMode === 4 ? 'bg-cyan-500 text-white' : 'bg-white/10 text-white/80'}`}
            onClick={() => setLineMode(4)}
          >
            4-line
          </button>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as 'english' | 'hindi' | 'hebrew')}
            className="rounded-2xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-extrabold text-white"
          >
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
            <option value="hebrew">Hebrew</option>
          </select>
        </div>
      </div>

      <div className="fs-card rounded-3xl border border-sky-400/30 bg-sky-500/10 p-4">
        <KaraokeOneDeviceAudio
          variant="host"
          activeSong={song ? { id: song.id, title: song.title, audioFileUrl: song.audioFileUrl || null } : null}
          playbackStatus="idle"
        />
      </div>

      <div className="fs-card-karaoke rounded-3xl border-2 p-4 sm:p-6">
        {rows.length === 0 ? (
          <p className="text-center text-white/70">No lyrics available yet for this song.</p>
        ) : (
          <div className="space-y-2" data-testid="practice-lyrics-panel">
            {rows.map((row) =>
              row.isCurrent ? (
                <p key={row.lineNumber} className="fs-lyric-hero text-center sm:text-left">
                  {row.text}
                </p>
              ) : (
                <p key={row.lineNumber} className="fs-lyric-sub text-center sm:text-left">
                  {row.text}
                </p>
              )
            )}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            onClick={() => step(-1)}
            disabled={currentIndex <= 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-2xl bg-fuchsia-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            onClick={() => step(1)}
            disabled={currentIndex < 0 || currentIndex >= sortedNumbers.length - 1}
          >
            Next
          </button>
          <button
            type="button"
            className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            onClick={() => setCurrentLineNumber(sortedNumbers[0] ?? null)}
            disabled={sortedNumbers.length === 0}
          >
            Restart
          </button>
          <button
            type="button"
            className="rounded-2xl border border-rose-400/40 bg-rose-500/20 px-4 py-2 text-sm font-bold text-rose-100"
            onClick={() => setCurrentLineNumber(sortedNumbers[sortedNumbers.length - 1] ?? null)}
            disabled={sortedNumbers.length === 0}
          >
            Last line
          </button>
        </div>
      </div>
    </div>
  )
}
