export default function AboutLoading() {
  return (
    <div className="px-4 pt-8 pb-16 sm:px-6 md:px-12">
      <div className="mx-auto max-w-5xl space-y-10">
        {/* Hero card */}
        <div className="rounded-[12px] border border-[var(--line)] bg-[var(--bg-1)] px-6 py-10 sm:px-10 sm:py-14">
          <div className="mb-4 h-3 w-28 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="mb-2 h-12 w-11/12 max-w-3xl animate-pulse rounded-lg bg-white/[0.09]" />
          <div className="mb-5 h-12 w-2/3 max-w-xl animate-pulse rounded-lg bg-white/[0.09]" />
          <div className="mb-2 h-4 w-full max-w-2xl animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="mb-8 h-4 w-4/5 max-w-xl animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-11 w-44 animate-pulse rounded-full bg-white/[0.10]" />
        </div>
        {/* 3 cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg-1)] p-6"
            >
              <div className="h-6 w-40 animate-pulse rounded-lg bg-white/[0.08]" />
              <div className="h-4 w-full animate-pulse rounded-lg bg-white/[0.05]" />
              <div className="h-4 w-11/12 animate-pulse rounded-lg bg-white/[0.05]" />
              <div className="h-4 w-4/5 animate-pulse rounded-lg bg-white/[0.05]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
