import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { previewTextForLine } from '@/lib/lyricPreview'
import type { LyricLineDTO } from '@/types/lyric'

const jsonHeaders = { 'Content-Type': 'application/json' }

export type LyricLineRow = LyricLineDTO & { _key: string }

function rkey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `k-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toRow(d: LyricLineDTO, k?: string): LyricLineRow {
  return {
    ...d,
    _key: k ?? d.id ?? rkey()
  }
}

export function AdminSongLyricsPage() {
  const { songId } = useParams()
  const [title, setTitle] = useState('')
  const [rows, setRows] = useState<LyricLineRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewLang, setPreviewLang] = useState<'en' | 'hi' | 'he'>('en')
  const [bulk, setBulk] = useState('')
  const [bulkTarget, setBulkTarget] = useState<'en' | 'hi' | 'he'>('en')

  const load = useCallback(async () => {
    if (!songId) {
      return
    }
    setLoading(true)
    setError(null)
    const r = await fetch(`/api/admin/songs/${songId}/lyrics`, { credentials: 'include' })
    if (!r.ok) {
      setError('Could not load lyrics.')
      setLoading(false)
      return
    }
    const j = (await r.json()) as {
      lines: LyricLineDTO[]
      song: { title: string }
    }
    setTitle(j.song.title)
    setRows(
      (j.lines || [])
        .slice()
        .sort((a, b) => a.lineNumber - b.lineNumber)
        .map((l) => toRow(l))
    )
    setLoading(false)
  }, [songId])

  useEffect(() => {
    void load()
  }, [load])

  function setRow(
    k: string,
    patch: Partial<
      Pick<
        LyricLineRow,
        'textEnglish' | 'textHindi' | 'textHebrew' | 'startTimeSeconds' | 'endTimeSeconds'
      >
    >
  ) {
    setRows((prev) =>
      prev.map((r) => (r._key === k ? { ...r, ...patch } : r))
    )
  }

  function addLine() {
    const n = rows.length
    setRows((p) => [
      ...p,
      toRow(
        {
          lineNumber: n,
          startTimeSeconds: null,
          endTimeSeconds: null,
          textEnglish: '',
          textHindi: '',
          textHebrew: ''
        },
        rkey()
      )
    ])
  }

  function removeLine(k: string) {
    setRows((p) => p.filter((r) => r._key !== k))
  }

  function moveLine(k: string, dir: -1 | 1) {
    setRows((p) => {
      const i = p.findIndex((r) => r._key === k)
      if (i < 0) {
        return p
      }
      const j = i + dir
      if (j < 0 || j >= p.length) {
        return p
      }
      const c = [...p]
      const t = c[i]!
      c[i] = c[j]!
      c[j] = t
      return c
    })
  }

  function applyBulk() {
    const part = bulk
      .split(/\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    if (part.length === 0) {
      return
    }
    setRows((prev) => {
      const start = prev.length
      const ins: LyricLineRow[] = part.map((text, i) => {
        const d: LyricLineDTO = {
          lineNumber: start + i,
          startTimeSeconds: null,
          endTimeSeconds: null,
          textEnglish: bulkTarget === 'en' ? text : '',
          textHindi: bulkTarget === 'hi' ? text : '',
          textHebrew: bulkTarget === 'he' ? text : ''
        }
        return toRow(d, rkey())
      })
      return [...prev, ...ins]
    })
    setBulk('')
  }

  function buildPayload() {
    const good = rows.filter((r) => {
      return (
        r.textEnglish.trim() || r.textHindi.trim() || r.textHebrew.trim()
      )
    })
    return good.map((r, i) => ({
      lineNumber: i,
      startTimeSeconds:
        r.startTimeSeconds == null ? null : Number(r.startTimeSeconds),
      endTimeSeconds:
        r.endTimeSeconds == null ? null : Number(r.endTimeSeconds),
      textEnglish: r.textEnglish,
      textHindi: r.textHindi,
      textHebrew: r.textHebrew
    }))
  }

  async function onSave() {
    if (!songId) {
      return
    }
    setError(null)
    setSaving(true)
    const body = { lines: buildPayload() }
    const r = await fetch(`/api/admin/songs/${songId}/lyrics`, {
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
    const j = (await r.json()) as { lines: LyricLineDTO[] }
    setRows(
      (j.lines || [])
        .sort((a, b) => a.lineNumber - b.lineNumber)
        .map((l) => toRow(l))
    )
  }

  if (!songId) {
    return null
  }
  if (loading) {
    return <p className="text-sm font-bold text-white/80">Loading…</p>
  }

  return (
    <div className="max-w-3xl space-y-4 text-left text-white">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-amber-200/90">
            Song · {title}
          </p>
          <h1 className="text-2xl font-black">Lyrics</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button to={`/admin/songs/${songId}/edit`} variant="ghost-lobby" className="!min-h-12">
            Back to song
          </Button>
          <Link
            to="/admin/songs"
            className="fs-button inline-block min-h-12 w-full text-center no-underline sm:w-auto"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            All songs
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

      <div className="fs-card-lobby space-y-3 text-sm">
        <p className="text-xs font-extrabold uppercase text-cyan-100/90">Preview</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-white/80">Language:</span>
          {(['en', 'hi', 'he'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setPreviewLang(l)}
              className={`min-h-10 touch-manipulation rounded-full px-3 text-sm font-extrabold ${
                previewLang === l
                  ? 'bg-amber-200 text-slate-900'
                  : 'bg-white/10 text-white/90'
              }`}
            >
              {l === 'en' ? 'English' : l === 'hi' ? 'Hindi' : 'Hebrew'}
            </button>
          ))}
        </div>
        <div className="max-h-64 overflow-y-auto rounded-2xl border border-white/20 bg-slate-900/40 p-3 text-base leading-relaxed text-white/95">
          {rows.length === 0 ? (
            <p className="text-sm text-white/60">No lines yet. Add or import below.</p>
          ) : (
            <ol className="list-decimal space-y-2 pl-5">
              {rows.map((r) => {
                const t = previewTextForLine(r, previewLang)
                return (
                  <li key={r._key} className="whitespace-pre-wrap text-balance">
                    {t || <span className="text-white/40">(empty in this view)</span>}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>

      <div className="fs-card-lobby space-y-2 text-sm">
        <p className="text-xs font-extrabold uppercase text-fuchsia-100/90">
          Bulk paste (one line per line)
        </p>
        <p className="text-white/75">
          Pasted text is split on new lines. Choose which language column to fill; other
          columns stay empty for those rows.
        </p>
        <select
          className="w-full min-h-11 max-w-xs rounded-2xl border-2 border-white/25 bg-slate-900/30 px-2 text-base font-bold"
          value={bulkTarget}
          onChange={(e) => setBulkTarget(e.target.value as 'en' | 'hi' | 'he')}
        >
          <option value="en">Into English</option>
          <option value="hi">Into Hindi</option>
          <option value="he">Into Hebrew</option>
        </select>
        <textarea
          rows={4}
          className="w-full rounded-2xl border-2 border-white/25 bg-slate-900/30 px-3 py-2 text-base text-white"
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          placeholder="Line 1&#10;Line 2"
        />
        <button
          type="button"
          onClick={applyBulk}
          className="min-h-11 w-full touch-manipulation rounded-2xl bg-cyan-400 px-4 text-sm font-extrabold text-slate-900 sm:w-auto"
        >
          Add pasted lines
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((r, idx) => (
          <div
            key={r._key}
            className="fs-card-lobby space-y-2 border-l-4 border-lime-300/50 !p-3 sm:!p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-lime-100/90">Line {idx + 1}</span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => moveLine(r._key, -1)}
                  disabled={idx === 0}
                  className="min-h-9 min-w-[2.5rem] touch-manipulation rounded-xl bg-white/10 px-2 text-xs font-extrabold disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveLine(r._key, 1)}
                  disabled={idx === rows.length - 1}
                  className="min-h-9 min-w-[2.5rem] touch-manipulation rounded-xl bg-white/10 px-2 text-xs font-extrabold disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeLine(r._key)}
                  className="min-h-9 touch-manipulation rounded-xl bg-rose-500/30 px-2 text-xs font-extrabold text-rose-100"
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              <label className="text-[0.65rem] font-extrabold uppercase text-amber-100/80">
                start (s)
                <input
                  type="number"
                  className="mt-0.5 w-full min-h-10 rounded-xl border border-white/20 bg-slate-900/40 px-2 text-sm"
                  value={r.startTimeSeconds ?? ''}
                  onChange={(e) =>
                    setRow(r._key, {
                      startTimeSeconds: e.target.value === '' ? null : Number(e.target.value)
                    })
                  }
                />
              </label>
              <label className="text-[0.65rem] font-extrabold uppercase text-amber-100/80">
                end (s)
                <input
                  type="number"
                  className="mt-0.5 w-full min-h-10 rounded-xl border border-white/20 bg-slate-900/40 px-2 text-sm"
                  value={r.endTimeSeconds ?? ''}
                  onChange={(e) =>
                    setRow(r._key, {
                      endTimeSeconds: e.target.value === '' ? null : Number(e.target.value)
                    })
                  }
                />
              </label>
            </div>
            <label className="text-[0.65rem] font-extrabold text-lime-100/80">English</label>
            <textarea
              rows={2}
              className="w-full rounded-xl border border-white/20 bg-slate-900/30 px-2 py-1 text-sm"
              value={r.textEnglish}
              onChange={(e) => setRow(r._key, { textEnglish: e.target.value })}
            />
            <label className="text-[0.65rem] font-extrabold text-fuchsia-100/80">Hindi</label>
            <textarea
              rows={2}
              className="w-full rounded-xl border border-white/20 bg-slate-900/30 px-2 py-1 text-sm"
              value={r.textHindi}
              onChange={(e) => setRow(r._key, { textHindi: e.target.value })}
            />
            <label className="text-[0.65rem] font-extrabold text-violet-100/80">Hebrew</label>
            <textarea
              rows={2}
              className="w-full rounded-xl border border-white/20 bg-slate-900/30 px-2 py-1 text-sm"
              value={r.textHebrew}
              onChange={(e) => setRow(r._key, { textHebrew: e.target.value })}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={addLine}
          className="min-h-12 w-full touch-manipulation rounded-2xl border-2 border-white/30 bg-white/10 px-4 text-sm font-extrabold sm:w-auto"
        >
          + Add line
        </button>
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="!min-h-12 w-full sm:w-auto"
        >
          {saving ? 'Saving…' : 'Save all lines'}
        </Button>
      </div>
    </div>
  )
}
