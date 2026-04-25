import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type PageShellMode = 'lobby' | 'karaoke'

export function PageShell({
  mode = 'lobby',
  children,
  className
}: {
  mode?: PageShellMode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      data-ui={mode}
      className={cn(
        'flex min-h-svh flex-col',
        mode === 'lobby' ? 'fs-shell-lobby' : 'fs-shell-karaoke',
        className
      )}
    >
      {children}
    </div>
  )
}

export function PageShellContent({
  children,
  className
}: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-4xl', className)}>{children}</div>
}
