export default function ComingSoonLoading() {
  return (
    <div className="pb-20">
      {/* Header */}
      <div className="px-6 pt-16 pb-12 md:px-12">
        <div className="h-4 w-32 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mt-3 h-10 w-64 animate-pulse rounded-xl bg-white/[0.08]" />
        <div className="mt-3 h-4 w-80 animate-pulse rounded-lg bg-white/[0.06]" />
      </div>

      {/* Show cards — landscape 16:9 grid */}
      <div className="px-6 md:px-12">
        <div className="mb-4 h-5 w-40 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-video w-full animate-pulse rounded-xl bg-white/[0.06]" />
              <div className="h-4 w-3/4 animate-pulse rounded-lg bg-white/[0.07]" />
              <div className="h-3 w-1/2 animate-pulse rounded-lg bg-white/[0.05]" />
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming episodes by show */}
      <div className="mt-12 space-y-8 px-6 md:px-12">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4"
          >
            <div className="aspect-video w-[120px] shrink-0 animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-5 w-2/3 animate-pulse rounded-lg bg-white/[0.08]" />
              <div className="h-3 w-full animate-pulse rounded bg-white/[0.05]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
