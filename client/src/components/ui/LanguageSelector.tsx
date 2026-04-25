import { cn } from '@/lib/cn'

export const FUNSONG_LANGUAGES = [
  { id: 'en' as const, label: 'English', native: 'English' },
  { id: 'hi' as const, label: 'Hindi', native: 'हिन्दी' },
  { id: 'he' as const, label: 'Hebrew', native: 'עברית' }
]

export type FunSongLangId = (typeof FUNSONG_LANGUAGES)[number]['id']

export function LanguageSelector({
  value,
  onChange,
  'aria-label': ariaLabel = 'UI language',
  className
}: {
  value: FunSongLangId
  onChange: (id: FunSongLangId) => void
  'aria-label'?: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'grid w-full max-w-sm grid-cols-3 gap-2 sm:max-w-none',
        className
      )}
    >
      {FUNSONG_LANGUAGES.map((L) => {
        const on = L.id === value
        return (
          <button
            key={L.id}
            type="button"
            onClick={() => onChange(L.id)}
            className={cn(
              'touch-manipulation rounded-2xl border-2 px-2 py-3 text-sm font-extrabold leading-tight transition will-change-transform active:scale-[0.99] sm:min-h-[3.5rem] sm:py-4',
              on
                ? 'border-amber-200/90 bg-amber-100 text-slate-900 shadow-md ring-2 ring-amber-300/80'
                : 'border-white/20 bg-white/10 text-white/90 hover:border-white/40'
            )}
          >
            <span
              className={cn(
                'block text-[0.7rem] font-bold uppercase tracking-widest sm:text-xs',
                on ? 'text-amber-900/70' : 'text-white/70'
              )}
            >
              {L.label}
            </span>
            <span className="mt-0.5 block text-base sm:text-lg">{L.native}</span>
          </button>
        )
      })}
    </div>
  )
}
