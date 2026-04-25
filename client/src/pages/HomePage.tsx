import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  type FunSongLangId,
  LanguageSelector,
  StatusPill
} from '@/components/ui'

export function HomePage() {
  const [lang, setLang] = useState<FunSongLangId>('en')
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
    </div>
  )
}
