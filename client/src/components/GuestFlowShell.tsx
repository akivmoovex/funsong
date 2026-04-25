import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PageShell, type PageShellMode } from '@/components/ui'
import { cn } from '@/lib/cn'

export function GuestFlowShell({
  children,
  mode = 'lobby',
  className
}: {
  children: React.ReactNode
  /** `lobby` = bright join / playlist. `karaoke` = dark focused stage. */
  mode?: PageShellMode
  className?: string
}) {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'robots')
    meta.setAttribute('content', 'noindex, nofollow')
    meta.setAttribute('data-funsong-guest', '1')
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [])

  return (
    <PageShell mode={mode}>
      <div
        className={cn(
          'min-h-[100dvh] flex w-full flex-1 flex-col self-center px-4 py-5 sm:py-6',
          'max-w-md sm:px-5 md:max-w-2xl md:px-6 lg:max-w-3xl',
          className
        )}
      >
        <header className="shrink-0">
          <Link
            to="/"
            className={cn(
              'inline-block text-sm font-extrabold no-underline drop-shadow',
              mode === 'karaoke' ? 'text-fuchsia-200/95 hover:text-white' : 'text-white/90'
            )}
          >
            ← FunSong
          </Link>
        </header>
        <main className="mt-3 min-h-0 flex-1 w-full min-w-0 sm:mt-4">{children}</main>
      </div>
    </PageShell>
  )
}
