import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { preparePartyCodeForJoin, validatePartyCodeForJoin } from '@/lib/partyCodeJoin'

type Props = {
  /** Prefix for `id` / `name` to avoid duplicate ids on one page. */
  idPrefix: 'home' | 'join' | 'other'
  className?: string
}

/**
 * Submits to `/join/:partyCode` — same as scanning a QR that encodes that path.
 */
export function ManualPartyCodeJoinForm({ idPrefix, className }: Props) {
  const nav = useNavigate()
  const inputId = `${idPrefix}-party-code-input`
  const [raw, setRaw] = useState('')
  const [err, setErr] = useState<string | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const prepared = preparePartyCodeForJoin(raw)
    const v = validatePartyCodeForJoin(prepared)
    if (v === 'empty') {
      setErr('empty')
      return
    }
    if (v === 'invalid') {
      setErr('invalid')
      return
    }
    setErr(null)
    nav(`/join/${encodeURIComponent(prepared)}`)
  }

  return (
    <form
      onSubmit={onSubmit}
      className={className}
      data-testid={`${idPrefix}-manual-join-form`}
    >
      <label
        htmlFor={inputId}
        className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-white/70"
      >
        Enter party code
      </label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          id={inputId}
          name="partyCode"
          data-testid={`${idPrefix}-party-code-input`}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value)
            if (err) setErr(null)
          }}
          placeholder="e.g. Ab3xK9mQ2z"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="min-h-12 w-full min-w-0 touch-manipulation rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-base font-bold text-white placeholder:text-white/45"
        />
        <button
          type="submit"
          className="min-h-12 shrink-0 touch-manipulation rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-500/25 active:scale-[0.99] sm:min-w-40"
        >
          Join Party
        </button>
      </div>
      {err && (
        <p className="mt-2 text-sm text-rose-200" role="alert">
          {err === 'empty' && 'Enter a party code first.'}
          {err === 'invalid' && 'That code format looks wrong. Check and try again.'}
        </p>
      )}
    </form>
  )
}
