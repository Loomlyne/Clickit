export default function AuthLoading() {
  return (
    <div className="-mt-16 flex min-h-[calc(100dvh-4rem)] overflow-hidden">
      {/* Left — hero backdrop (hidden on mobile) */}
      <div className="relative hidden w-1/2 animate-pulse bg-white/[0.03] lg:block">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(10,10,10,0.7) 0%, transparent 60%), linear-gradient(180deg, transparent 0%, rgba(10,10,10,0.8) 100%)',
          }}
        />
        {/* Quote skeleton at bottom-left */}
        <div className="absolute bottom-12 left-12 space-y-3">
          <div className="h-7 w-80 animate-pulse rounded-xl bg-white/[0.08]" />
          <div className="h-7 w-64 animate-pulse rounded-xl bg-white/[0.08]" />
          <div className="mt-2 h-3 w-32 animate-pulse rounded bg-white/[0.06]" />
        </div>
      </div>

      {/* Right — auth form */}
      <div className="flex w-full items-center justify-center bg-[var(--bg-0)] px-5 py-8 sm:px-6 md:py-12 lg:w-1/2 lg:py-16">
        <div className="w-full max-w-[420px] space-y-5">
          {/* Heading */}
          <div className="h-10 w-56 animate-pulse rounded-xl bg-white/[0.08]" />
          <div className="h-4 w-72 animate-pulse rounded-lg bg-white/[0.06]" />
          {/* Form fields */}
          <div className="mt-6 space-y-4">
            <div className="h-12 w-full animate-pulse rounded-xl bg-white/[0.06]" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-white/[0.06]" />
            <div className="h-12 w-full animate-pulse rounded-full bg-white/[0.10]" />
          </div>
          {/* Divider + social */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 animate-pulse bg-white/[0.06]" />
            <div className="h-3 w-6 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-px flex-1 animate-pulse bg-white/[0.06]" />
          </div>
          <div className="flex gap-3">
            <div className="h-11 flex-1 animate-pulse rounded-xl bg-white/[0.06]" />
            <div className="h-11 flex-1 animate-pulse rounded-xl bg-white/[0.06]" />
          </div>
          {/* Skip link */}
          <div className="flex justify-center">
            <div className="h-4 w-32 animate-pulse rounded-lg bg-white/[0.06]" />
          </div>
        </div>
      </div>
    </div>
  )
}
