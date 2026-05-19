export default function SearchLoading() {
  return (
    <div className="px-6 pt-24 pb-16 md:px-12 md:pt-28">
      {/* Search header skeleton */}
      <div className="mb-2 h-3 w-20 animate-pulse rounded-lg bg-white/[0.06]" />
      <div className="h-8 w-48 animate-pulse rounded-xl bg-white/[0.06]" />

      {/* Results grid skeleton */}
      <div className="mt-10 space-y-8">
        {/* Shows section */}
        <div>
          <div className="mb-4 h-5 w-24 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-white/[0.06]" />
                <div className="h-4 w-3/4 animate-pulse rounded-lg bg-white/[0.06]" />
                <div className="h-3 w-1/2 animate-pulse rounded-lg bg-white/[0.06]" />
              </div>
            ))}
          </div>
        </div>

        {/* Episodes section */}
        <div>
          <div className="mb-4 h-5 w-28 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
              >
                <div className="h-14 w-24 flex-shrink-0 animate-pulse rounded-lg bg-white/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded-lg bg-white/[0.06]" />
                  <div className="h-3 w-1/2 animate-pulse rounded-lg bg-white/[0.06]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
