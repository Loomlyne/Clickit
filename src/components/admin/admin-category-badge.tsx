import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { categoryChipStyle } from '@/lib/category-chip'

export function AdminCategoryBadge({
  name,
  color,
  className,
}: {
  name: string
  color?: string | null
  className?: string
}) {
  if (!color) {
    return (
      <Badge variant="secondary" className={className}>
        {name}
      </Badge>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        className
      )}
      style={categoryChipStyle(color)}
    >
      {name}
    </span>
  )
}
