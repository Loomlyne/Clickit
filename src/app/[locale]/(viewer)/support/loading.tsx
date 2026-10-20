export default function SupportLoading() {
  return (
    <div className="px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-20 md:px-12">
      {/* 2-col grid: info panel + contact form */}
      <div className="grid gap-px overflow-hidden rounded-[12px] border border-white/[0.08] bg-white/[0.08] lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left — info panel */}
        <div className="space-y-4 bg-[var(--bg-1)] p-6 sm:p-8 lg:p-10">
          <div className="h-3 w-20 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="h-12 w-3/4 animate-pulse rounded-lg bg-white/[0.09]" />
          <div className="h-4 w-full animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-5/6 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-4 w-4/5 animate-pulse rounded-lg bg-white/[0.06]" />
          {/* Brand strip */}
          <div className="mt-8 flex gap-1.5 pt-4">
            {[
              'bg-brand-blue',
              'bg-brand-purple',
              'bg-brand-green',
              'bg-brand-red',
              'bg-brand-orange',
              'bg-brand-yellow',
            ].map((color) => (
              <div
                key={color}
                className={`h-[3px] w-6 rounded-[1px] opacity-40 sm:w-8 ${color}`}
              />
            ))}
          </div>
        </div>

        {/* Right — contact form */}
        <div className="space-y-4 bg-[var(--bg-1)] p-6 sm:p-8 lg:p-10">
          <div className="h-5 w-32 animate-pulse rounded-lg bg-white/[0.07]" />
          <div className="h-12 w-full animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-12 w-full animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-12 w-full animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-28 w-full animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-12 w-36 animate-pulse rounded-full bg-white/[0.10]" />
        </div>
      </div>

      {/* FAQ section */}
      <section className="mt-12 sm:mt-16">
        <div className="mx-auto max-w-[860px] space-y-3">
          <div className="mb-3 h-9 w-full animate-pulse rounded-lg bg-white/[0.08] sm:w-80" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 w-full animate-pulse rounded-lg bg-white/[0.04]"
            />
          ))}
          <div className="h-11 w-36 animate-pulse rounded-full bg-white/[0.08]" />
        </div>
      </section>
    </div>
  )
}
