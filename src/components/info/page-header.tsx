import { cn } from '@/lib/utils'

const TITLE_SIZE = {
  page: 'text-[clamp(36px,5vw,64px)]',
  card: 'text-[clamp(34px,5vw,56px)]',
  panel: 'text-[clamp(34px,4vw,48px)]',
} as const

/** Small uppercase line above an info-page title. */
export function PageEyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={cn('mono mb-4 text-[var(--text-mute)]', className)}>
      {children}
    </p>
  )
}

/** The one title recipe for every info page (About, legal, Support, Updates). */
export function PageTitle({
  children,
  size = 'page',
  className,
}: {
  children: React.ReactNode
  size?: keyof typeof TITLE_SIZE
  className?: string
}) {
  return (
    <h1
      className={cn(
        'font-display leading-none font-normal tracking-[-0.02em] text-[var(--text)]',
        TITLE_SIZE[size],
        className
      )}
    >
      {children}
    </h1>
  )
}
