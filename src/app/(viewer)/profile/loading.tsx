export default function ProfileLoading() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl px-6 md:px-12 pt-24 md:pt-28 pb-16 space-y-8">
      {/* Profile header skeleton */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
        {/* Avatar circle */}
        <div className="size-20 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="h-4 w-36 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="mt-2 flex gap-3">
            <div className="h-9 w-28 animate-pulse rounded-full bg-white/[0.06]" />
            <div className="h-9 w-24 animate-pulse rounded-full bg-white/[0.06]" />
          </div>
        </div>
      </div>

      {/* Settings card skeleton */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-4">
        <div className="h-5 w-32 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="h-10 w-32 animate-pulse rounded-full bg-white/[0.06]" />
      </div>

      {/* My List skeleton */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-5 w-24 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-16 animate-pulse rounded-lg bg-white/[0.06]" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-32 flex-shrink-0 space-y-2">
              <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-white/[0.06]" />
              <div className="h-3 w-3/4 animate-pulse rounded-lg bg-white/[0.06]" />
            </div>
          ))}
        </div>
      </div>

      {/* Recently Watched skeleton */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-3">
        <div className="mb-2 h-5 w-40 animate-pulse rounded-lg bg-white/[0.06]" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <div className="h-12 w-20 animate-pulse rounded-lg bg-white/[0.06] flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded-lg bg-white/[0.06]" />
              <div className="h-3 w-1/2 animate-pulse rounded-lg bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
