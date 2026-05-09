export default function WatchLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <div className="-mt-24 md:-mt-28 h-dvh w-full bg-gradient-to-b from-white/5 to-transparent" />

      {/* Content rails skeleton */}
      <div className="mt-20 space-y-14 px-6 pb-20 md:px-12">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="mb-4 h-6 w-40 rounded bg-white/10" />
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3, 4, 5].map((j) => (
                <div
                  key={j}
                  className="h-56 w-40 flex-shrink-0 rounded-xl bg-white/5"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
