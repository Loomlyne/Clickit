export default function MyListLoading() {
  return (
    <div className="pb-16">
      {/* Header skeleton */}
      <div className="px-6 py-20 text-center md:px-12">
        <div className="mx-auto mb-4 h-4 w-20 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mx-auto h-10 w-56 animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="mx-auto mt-3 h-5 w-40 animate-pulse rounded-lg bg-white/[0.06]" />
      </div>

      {/* Grid skeleton — 2x3 */}
      <div className="px-6 md:px-12">
        <div className="mb-4 h-5 w-32 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-white/[0.06]" />
              <div className="h-4 w-3/4 animate-pulse rounded-lg bg-white/[0.06]" />
              <div className="h-3 w-1/2 animate-pulse rounded-lg bg-white/[0.06]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
