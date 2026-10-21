export default function ProfileLoading() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl space-y-8 px-4 pt-8 pb-16 sm:px-6 md:px-12">
      {/* Profile header skeleton */}
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
        <div className="size-20 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="flex flex-col items-center gap-2 sm:flex-1 sm:items-start">
          <div className="h-3 w-16 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-36 animate-pulse rounded-lg bg-white/[0.06]" />
        </div>
        <div className="flex gap-3">
          <div className="h-11 w-28 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="h-11 w-28 animate-pulse rounded-full bg-white/[0.06]" />
        </div>
      </div>

      {/* Account settings skeleton: three rows */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 sm:p-6">
        <div className="h-5 w-40 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="mt-2 mb-6 h-4 w-72 max-w-full animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="divide-y divide-[var(--line)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 py-4 first:pt-0 last:pb-0">
              <div className="h-4 w-28 animate-pulse rounded-lg bg-white/[0.06] sm:w-40" />
              <div className="h-11 flex-1 animate-pulse rounded-lg bg-white/[0.06]" />
            </div>
          ))}
        </div>
      </div>

      {/* My List + Liked skeleton */}
      <div className="grid gap-8 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, c) => (
          <div
            key={c}
            className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 sm:p-6"
          >
            <div className="mb-4 h-5 w-28 animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-32 flex-shrink-0 space-y-2">
                  <div className="aspect-[2/3] w-full animate-pulse rounded-media bg-white/[0.06]" />
                  <div className="h-3 w-3/4 animate-pulse rounded-lg bg-white/[0.06]" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recently watched skeleton */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 sm:p-6">
        <div className="mb-4 h-5 w-40 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex min-h-16 items-center gap-4 px-3 py-3">
              <div className="aspect-video w-20 flex-shrink-0 animate-pulse rounded-lg bg-white/[0.06]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded-lg bg-white/[0.06]" />
                <div className="h-3 w-1/2 animate-pulse rounded-lg bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
