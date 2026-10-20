import { cn } from '@/lib/utils'

// Category colour is data, so it shows as a dot; the chip itself stays neutral.
export function AdminCategoryBadge({
  name,
  color,
  className,
}: {
  name: string
  color?: string | null
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-0.5 text-[12px] text-[var(--text-dim)]',
        className
      )}
    >
      {color ? (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
      ) : null}
      {name}
    </span>
  )
}
