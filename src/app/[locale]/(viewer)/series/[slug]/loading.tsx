export default function Loading() {
  return (
    <div>
      <div className="bg-surface-2 -mt-16 min-h-[80vh] w-full animate-pulse" />
      <div className="mt-8 space-y-4 px-6 md:px-12">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="bg-surface-2 aspect-video w-[200px] flex-shrink-0 animate-pulse rounded-md" />
            <div className="flex flex-1 flex-col justify-center gap-2">
              <div className="bg-surface-2 h-4 w-48 animate-pulse rounded" />
              <div className="bg-surface-2 h-3 w-64 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
