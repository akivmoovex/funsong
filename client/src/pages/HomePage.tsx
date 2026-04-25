import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  type FunSongLangId,
  LanguageSelector,
  StatusPill
} from '@/components/ui'

const PARTY_CODE_RE = /^[A-Za-z0-9._-]{4,64}$/

export function HomePage() {
  const nav = useNavigate()
  const [lang, setLang] = useState<FunSongLangId>('en')
  const [partyCode, setPartyCode] = useState('')
  const [joinErr, setJoinErr] = useState<string | null>(null)

  function onJoinSubmit(e: FormEvent) {
    e.preventDefault()
    const code = String(partyCode || '').trim()
    if (!code) {
      setJoinErr('empty')
      return
    }
    if (!PARTY_CODE_RE.test(code)) {
      setJoinErr('invalid')
      return
    }
    setJoinErr(null)
    nav(`/join/${encodeURIComponent(code)}`)
  }

  return (
    <div className="space-y-6">
      <section>
        <Card
          surface="lobby"
          className="text-center"
          data-testid="home-hero-card"
        >
          <p className="text-sm font-bold uppercase tracking-widest text-lime-200">
            <Badge flavor="emerald" className="me-1 align-baseline sm:me-2">
              Live
            </Badge>
            <span>Private Hindi karaoke</span>
          </p>
          <h1 className="mt-2 text-4xl font-black leading-tight sm:text-5xl">
            Party mode: <span className="text-amber-200">ON</span>
          </h1>
          <p className="mt-3 text-balance text-base text-white/90">
            Build a room, get the crowd moving, and keep every phone in sync in
            real time.
          </p>
          <div className="mt-4 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-wrap sm:gap-2">
            <StatusPill kind="sync" icon={<span aria-hidden>⏱</span>}>
              {lang === 'hi' ? 'समकालीन' : lang === 'he' ? 'סנכרון' : 'Real-time sync'}
            </StatusPill>
            <StatusPill kind="success" icon={<span aria-hidden>✓</span>}>
              {lang === 'he' ? 'לובי' : 'Lobby style'}
            </StatusPill>
          </div>
        </Card>
      </section>

      <div className="text-center">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-widest text-white/80">
          UI language
        </p>
        <LanguageSelector value={lang} onChange={setLang} className="mx-auto" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button to="/host/dashboard" variant="lime">
          Host a party
        </Button>
        <Button to="/join" variant="cyan">
          Join a party
        </Button>
        <Button to="/admin" variant="fuchsia" className="sm:col-span-2">
          Super admin
        </Button>
        <Button
          to="/login"
          variant="amber"
          className="no-underline sm:col-span-2"
        >
          Sign in
        </Button>
      </div>

      <section>
        <Card surface="lobby" className="space-y-3 p-4 sm:p-5">
          <h2 className="text-xl font-black text-white sm:text-2xl">Join Party</h2>
          <p className="text-sm text-white/85">
            Got a party code from the host? Jump straight into the room.
          </p>
          <form onSubmit={onJoinSubmit} className="space-y-2">
            <label
              htmlFor="home-party-code"
              className="text-xs font-extrabold uppercase tracking-widest text-white/70"
            >
              Party code
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="home-party-code"
                name="partyCode"
                value={partyCode}
                onChange={(e) => {
                  setPartyCode(e.target.value)
                  if (joinErr) setJoinErr(null)
                }}
                placeholder="e.g. JoinCode01"
                autoComplete="off"
                className="min-h-12 w-full rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 text-base font-bold text-white placeholder:text-white/45"
              />
              <button
                type="submit"
                className="min-h-12 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-500/25 active:scale-[0.99] sm:min-w-36"
              >
                Join Party
              </button>
            </div>
            {joinErr && (
              <p className="text-sm text-rose-200" role="alert">
                {joinErr === 'empty' && 'Enter a party code first.'}
                {joinErr === 'invalid' && 'That code format looks wrong. Check and try again.'}
              </p>
            )}
          </form>
        </Card>
      </section>
    </div>
  )
}
