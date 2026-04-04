export default function ScheduleLoading() {
  return (
    <div className="pb-16">
      {/* Header skeleton */}
      <div className="py-20 px-6 md:px-12 text-center">
        <div className="mx-auto mb-4 h-4 w-16 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mx-auto h-10 w-44 animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="mx-auto mt-3 h-5 w-56 animate-pulse rounded-lg bg-white/[0.06]" />
      </div>

      {/* Day groups skeleton */}
      <div className="px-6 md:px-12 space-y-10">
        {Array.from({ length: 3 }).map((_, dayIdx) => (
          <div key={dayIdx}>
            <div className="mb-1 h-3 w-24 animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="mb-5 h-7 w-32 animate-pulse rounded-xl bg-white/[0.06]" />
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, rowIdx) => (
                <div
                  key={rowIdx}
                  className="flex items-center gap-4 rounded-xl bg-white/[0.03] border border-white/[0.06] p-4"
                >
                  <div className="size-16 animate-pulse rounded-lg bg-white/[0.06] flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 animate-pulse rounded-lg bg-white/[0.06]" />
                    <div className="h-3 w-24 animate-pulse rounded-lg bg-white/[0.06]" />
                  </div>
                  <div className="h-6 w-16 animate-pulse rounded-full bg-white/[0.06] flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
