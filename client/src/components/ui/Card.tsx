import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type CardSurface = 'lobby' | 'karaoke'

export function Card({
  children,
  surface = 'lobby',
  className,
  ...rest
}: { children: ReactNode; surface?: CardSurface } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        surface === 'lobby' ? 'fs-card-lobby' : 'fs-card-karaoke',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
