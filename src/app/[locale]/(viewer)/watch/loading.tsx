export default function WatchLoading() {
  return (
    <div className="animate-pulse">
      {/* Match live hub: hero offset + 78vh carousel area (see hero-banner + watch page -mt-16) */}
      <div className="-mt-16 mb-3 h-[78vh] min-h-[480px] w-full rounded-none bg-gradient-to-b from-white/[0.07] to-transparent md:min-h-[580px]" />

      <div className="mt-12 space-y-14 px-6 pb-20 md:px-10">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="mb-4 h-6 w-40 rounded bg-white/10" />
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3, 4, 5].map((j) => (
                <div
                  key={j}
                  className="h-56 w-40 flex-shrink-0 rounded-xl bg-white/5 sm:w-44"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
