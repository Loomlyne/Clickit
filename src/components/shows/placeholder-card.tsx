import { cn } from '@/lib/utils'

export function PlaceholderCard() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'overflow-hidden rounded-lg opacity-60'
      )}
    >
      {/* Muted brand ribbon - border color, no bright brand color */}
      <div className="h-1 bg-border" />

      {/* Artwork area - 16:9 aspect ratio, muted surface */}
      <div className="relative flex aspect-video items-center justify-center bg-surface-3">
        <span className="text-sm text-text-muted">Coming Soon</span>
      </div>

      {/* Card text area - skeleton placeholders */}
      <div className="bg-card p-4">
        {/* Skeleton title line */}
        <div className="h-4 w-24 rounded bg-surface-3" />
        {/* Skeleton badge line */}
        <div className="mt-2 h-3 w-16 rounded bg-surface-3" />
      </div>
    </div>
  )
}
