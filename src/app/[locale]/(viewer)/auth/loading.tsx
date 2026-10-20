export default function AuthLoading() {
  return (
    <div className="-mt-16 flex min-h-[calc(100dvh-4rem)] overflow-hidden">
      {/* Left — hero backdrop (hidden below lg) */}
      <div className="relative hidden w-1/2 animate-pulse bg-white/[0.03] lg:block">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(0deg,color-mix(in_srgb,var(--bg-0)_94%,transparent)_0%,color-mix(in_srgb,var(--bg-0)_62%,transparent)_42%,color-mix(in_srgb,var(--bg-0)_8%,transparent)_100%)]"
        />
        {/* Quote skeleton at bottom */}
        <div className="absolute bottom-12 start-12 space-y-3">
          <div className="h-7 w-80 animate-pulse rounded-lg bg-white/[0.08]" />
          <div className="h-7 w-64 animate-pulse rounded-lg bg-white/[0.08]" />
          <div className="mt-2 h-3 w-32 animate-pulse rounded bg-white/[0.06]" />
        </div>
      </div>

      {/* Right — heading, tabs, fields, submit (same order as the page) */}
      <div className="flex w-full items-center justify-center bg-[var(--bg-0)] px-4 py-8 sm:px-6 md:py-12 lg:w-1/2 lg:py-16">
        <div className="w-full max-w-[420px]">
          <div className="h-10 w-56 animate-pulse rounded-lg bg-white/[0.08]" />
          <div className="mt-2 mb-6 h-4 w-72 max-w-full animate-pulse rounded-lg bg-white/[0.06] md:mb-8" />
          <div className="h-[52px] w-full animate-pulse rounded-full bg-white/[0.06]" />
          <div className="mt-6 space-y-4">
            <div className="h-11 w-full animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="h-11 w-full animate-pulse rounded-full bg-white/[0.10]" />
          </div>
          <div className="mt-4 flex justify-center">
            <div className="h-4 w-32 animate-pulse rounded-lg bg-white/[0.06]" />
          </div>
        </div>
      </div>
    </div>
  )
}
