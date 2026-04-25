import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps, type To } from 'react-router-dom'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'lime' | 'cyan' | 'fuchsia' | 'amber' | 'ghost-lobby' | 'ghost-karaoke'
export type ButtonSize = 'lg' | 'md' | 'sm'

const variantClass: Record<ButtonVariant, string> = {
  lime: 'fs-button fs-button--lime',
  cyan: 'fs-button fs-button--cyan',
  fuchsia: 'fs-button fs-button--fuchsia',
  amber: 'fs-button fs-button--amber',
  'ghost-lobby':
    'inline-flex min-h-[3.5rem] min-w-full touch-manipulation items-center justify-center rounded-2xl border-2 border-white/30 bg-white/10 px-4 text-center text-base font-extrabold text-white shadow transition will-change-transform active:scale-[0.99] sm:min-w-0',
  'ghost-karaoke':
    'inline-flex min-h-[3.5rem] min-w-full touch-manipulation items-center justify-center rounded-2xl border-2 border-violet-500/40 bg-slate-800/80 px-4 text-center text-base font-extrabold text-slate-100 shadow transition will-change-transform active:scale-[0.99] sm:min-w-0'
}

const sizeTweak: Record<ButtonSize, string> = {
  lg: '',
  md: '!min-h-[3.25rem] !text-base',
  sm: '!min-h-11 !text-sm !px-4 !rounded-xl'
}

type Base = {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

export type AppButtonAsButton = Base & ButtonHTMLAttributes<HTMLButtonElement> & { to?: never }
export type AppButtonAsLink = Base & Omit<LinkProps, 'className' | 'children' | 'to'> & { to: To }
export type AppButtonProps = AppButtonAsButton | AppButtonAsLink

export function Button({
  children,
  variant = 'lime',
  size = 'lg',
  className,
  ...rest
}: AppButtonProps) {
  const c = cn(variantClass[variant], sizeTweak[size], className)
  if ('to' in rest) {
    const { to, ...linkProps } = rest
    return (
      <Link to={to} className={c} {...linkProps}>
        {children}
      </Link>
    )
  }
  const { type = 'button', ...btnProps } = rest as AppButtonAsButton
  return (
    <button type={type} className={c} {...btnProps}>
      {children}
    </button>
  )
}
