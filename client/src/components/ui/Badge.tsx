import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeFlavor =
  | 'lime'
  | 'cyan'
  | 'fuchsia'
  | 'amber'
  | 'violet'
  | 'emerald'
  | 'rose'

const flavor: Record<
  BadgeFlavor,
  { bg: string; ring: string; text: string }
> = {
  lime: { bg: 'bg-lime-300', ring: 'ring-lime-600/20', text: 'text-slate-900' },
  cyan: { bg: 'bg-cyan-300', ring: 'ring-cyan-600/20', text: 'text-slate-900' },
  fuchsia: { bg: 'bg-fuchsia-500', ring: 'ring-fuchsia-900/30', text: 'text-white' },
  amber: { bg: 'bg-amber-300', ring: 'ring-amber-800/20', text: 'text-slate-900' },
  violet: { bg: 'bg-violet-500', ring: 'ring-violet-800/30', text: 'text-white' },
  emerald: { bg: 'bg-emerald-500', ring: 'ring-emerald-900/30', text: 'text-white' },
  rose: { bg: 'bg-rose-500', ring: 'ring-rose-900/30', text: 'text-white' }
}

export function Badge({
  children,
  className,
  flavor: f = 'violet',
  'aria-label': aria
}: {
  children: ReactNode
  className?: string
  flavor?: BadgeFlavor
  'aria-label'?: string
}) {
  const t = flavor[f]
  return (
    <span
      aria-label={aria}
      className={cn(
        'inline-flex max-w-full items-center rounded-full px-3 py-1 text-xs font-extrabold tracking-wide ring-2',
        t.bg,
        t.ring,
        t.text,
        className
      )}
    >
      {children}
    </span>
  )
}
