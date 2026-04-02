export default function Loading() {
  return (
    <div className="px-6 pt-12 pb-16 md:px-12">
      <div className="h-10 w-32 animate-pulse rounded bg-surface-2" />
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg">
            <div className="aspect-video w-full animate-pulse bg-surface-2" />
            <div className="bg-card p-4 space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
              <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
