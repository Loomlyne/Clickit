export default function PortfolioLoading() {
  return (
    <div>
      {/* Landing hero — full screen */}
      <div className="-mt-16 relative min-h-dvh w-full overflow-hidden bg-black">
        <div className="absolute inset-0 animate-pulse bg-white/[0.03]" />
        {/* Bottom overlay content */}
        <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center gap-5 px-6">
          <div className="h-4 w-28 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="h-16 w-96 max-w-full animate-pulse rounded-2xl bg-white/[0.10]" />
          <div className="h-5 w-72 max-w-full animate-pulse rounded-lg bg-white/[0.07]" />
          <div className="mt-2 flex gap-3">
            <div className="h-12 w-36 animate-pulse rounded-full bg-white/[0.14]" />
            <div className="h-12 w-28 animate-pulse rounded-full bg-white/[0.07]" />
          </div>
        </div>
      </div>

      {/* Shows portfolio section */}
      <section className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 md:px-10">
        <div className="mb-12 h-14 w-2/3 animate-pulse rounded-2xl bg-white/[0.06]" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-video w-full animate-pulse rounded-xl bg-white/[0.06]" />
              <div className="h-4 w-3/4 animate-pulse rounded-lg bg-white/[0.07]" />
            </div>
          ))}
        </div>
      </section>

      {/* Genre pills */}
      <section className="px-4 py-12 sm:px-6 md:px-10">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-24 animate-pulse rounded-full bg-white/[0.06]"
              style={{ width: `${60 + i * 10}px` }}
            />
          ))}
        </div>
      </section>

      {/* FAQ section */}
      <section className="mx-auto max-w-[1400px] px-4 py-16 sm:px-6 md:px-10">
        <div className="mb-8 h-10 w-56 animate-pulse rounded-2xl bg-white/[0.06]" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 w-full animate-pulse rounded-xl bg-white/[0.04]"
            />
          ))}
        </div>
      </section>
    </div>
  )
}
