import { cn } from '@/lib/utils'

interface ClickitLogoProps {
  className?: string
  dotClassName?: string
  textClassName?: string
}

export function ClickitLogo({ className, dotClassName, textClassName }: ClickitLogoProps) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <span
        className={cn(
          'mr-[0.52em] inline-block rounded-full bg-[#f5c51c]',
          dotClassName
        )}
      />
      <span
        className={cn(
          'font-[family-name:var(--font-ui)] text-[0.92em] font-extrabold uppercase leading-none tracking-[-0.045em] text-[var(--text)]',
          textClassName
        )}
      >
        CLICKIT
      </span>
    </span>
  )
}
