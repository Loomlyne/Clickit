export default function Loading() {
  return (
    <div>
      <div className="-mt-16 min-h-[80vh] w-full animate-pulse bg-surface-2" />
      <div className="px-6 md:px-12 mt-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="aspect-video w-[200px] flex-shrink-0 animate-pulse rounded-md bg-surface-2" />
            <div className="flex flex-col justify-center gap-2 flex-1">
              <div className="h-4 w-48 animate-pulse rounded bg-surface-2" />
              <div className="h-3 w-64 animate-pulse rounded bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
