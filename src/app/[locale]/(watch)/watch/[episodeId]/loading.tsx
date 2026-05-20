export default function WatchEpisodeLoading() {
  return (
    <div className="flex h-dvh flex-col bg-black">
      {/* Video player area */}
      <div className="w-full flex-1 animate-pulse bg-white/[0.04]" />

      {/* Episode tray — pinned at 134px (matches WATCH_TRAY_SNAP_POINTS[0]) */}
      <div className="h-[134px] w-full shrink-0 border-t border-white/[0.06] bg-[#0a0a0a] px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Show art thumbnail */}
          <div className="h-[88px] w-[60px] shrink-0 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="flex-1 space-y-2 overflow-hidden">
            {/* Season label */}
            <div className="h-3 w-20 animate-pulse rounded bg-white/[0.06]" />
            {/* Episode title */}
            <div className="h-5 w-3/4 animate-pulse rounded bg-white/[0.08]" />
            {/* Episode description */}
            <div className="h-3 w-full animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.06]" />
          </div>
          {/* Chevron handle */}
          <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-white/[0.06]" />
        </div>
      </div>
    </div>
  )
}
