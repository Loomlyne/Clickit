import { cn } from '@/lib/utils'

export function PlaceholderCard() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] opacity-60'
      )}
    >
      {/* Muted brand ribbon - border color, no bright brand color */}
      <div className="h-[2px] bg-white/[0.06]" />

      {/* Artwork area - 16:9 aspect ratio, muted surface */}
      <div className="relative flex aspect-video items-center justify-center bg-surface-3">
        <span className="mono">Coming Soon</span>
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
