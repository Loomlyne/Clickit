export default function Loading() {
  return (
    <div className="-mt-16">
      <div className="aspect-video w-full animate-pulse bg-surface-2" />
      <div className="px-4 md:px-6 pt-4 space-y-3">
        <div className="h-8 w-64 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  )
}
