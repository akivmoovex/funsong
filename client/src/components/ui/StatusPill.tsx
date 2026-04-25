import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type StatusKind = 'default' | 'success' | 'warning' | 'error' | 'sync'

const style: Record<
  StatusKind,
  { border: string; text: string; icon?: string; bg: string }
> = {
  default: {
    bg: 'bg-white/15',
    border: 'border-white/30',
    text: 'text-white/95'
  },
  success: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-300/50',
    text: 'text-emerald-200'
  },
  warning: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-200/50',
    text: 'text-amber-200'
  },
  error: {
    bg: 'bg-rose-500/20',
    border: 'border-rose-200/50',
    text: 'text-rose-200'
  },
  sync: {
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-200/50',
    text: 'text-cyan-200'
  }
}

export function StatusPill({
  children,
  kind = 'default',
  className,
  icon
}: {
  children: ReactNode
  kind?: StatusKind
  className?: string
  /** Optional short prefix (e.g. dot) */
  icon?: ReactNode
}) {
  const s = style[kind]
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-extrabold',
        s.bg,
        s.border,
        s.text,
        className
      )}
    >
      {icon}
      {children}
    </span>
  )
}
