export default function SeriesDetailLoading() {
  return (
    <div>
      {/* Cinematic hero — matches SeriesDetailHero: h-[72vh] min-h-[460px] */}
      <div className="-mt-16 relative h-[72vh] min-h-[460px] overflow-hidden bg-[var(--bg-2)]">
        {/* Backdrop shimmer */}
        <div className="absolute inset-0 animate-pulse bg-white/[0.04]" />

        {/* Gradient scrim */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(10,10,10,0.4) 40%, var(--bg-0) 98%), linear-gradient(90deg, rgba(10,10,10,0.6) 0%, transparent 60%)',
          }}
        />

        {/* Content overlay — bottom-left, mirrors hero layout */}
        <div className="absolute start-4 end-4 bottom-10 z-10 max-w-[720px] sm:start-10 sm:end-10 sm:bottom-[60px]">
          {/* Genre pill */}
          <div className="mb-4 h-4 w-20 animate-pulse rounded-full bg-white/[0.10]" />
          {/* Title — 2 lines */}
          <div className="mb-2 h-14 w-3/4 animate-pulse rounded-lg bg-white/[0.12]" />
          <div className="mb-5 h-10 w-1/2 animate-pulse rounded-lg bg-white/[0.08]" />
          {/* Description — 3 lines */}
          <div className="mb-1.5 h-4 w-full animate-pulse rounded bg-white/[0.07]" />
          <div className="mb-1.5 h-4 w-5/6 animate-pulse rounded bg-white/[0.07]" />
          <div className="mb-6 h-4 w-2/3 animate-pulse rounded bg-white/[0.07]" />
          {/* Meta row */}
          <div className="mb-7 flex items-center gap-4">
            <div className="h-3 w-16 animate-pulse rounded bg-white/[0.07]" />
            <div className="h-3 w-16 animate-pulse rounded bg-white/[0.07]" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/[0.07]" />
          </div>
          {/* CTA buttons */}
          <div className="flex items-center gap-3">
            <div className="h-11 w-36 animate-pulse rounded-full bg-white/[0.14]" />
            <div className="h-11 w-11 animate-pulse rounded-full bg-white/[0.08]" />
            <div className="h-11 w-11 animate-pulse rounded-full bg-white/[0.08]" />
          </div>
        </div>
      </div>

      {/* Season tabs */}
      <div className="mt-8 flex gap-2 px-6 md:px-12">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-24 animate-pulse rounded-full bg-white/[0.06]"
          />
        ))}
      </div>

      {/* Episode rows */}
      <div className="mt-4 space-y-3 px-6 md:px-12">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"
          >
            <div className="aspect-video w-[140px] shrink-0 animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-1/4 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-5 w-2/3 animate-pulse rounded-lg bg-white/[0.08]" />
              <div className="h-3 w-full animate-pulse rounded bg-white/[0.05]" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.05]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
