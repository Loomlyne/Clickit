export default function PrivacyLoading() {
  return (
    <div className="mx-auto max-w-[860px] px-4 pt-12 pb-20 sm:px-6 md:px-10 md:pt-16 md:pb-24">
      <div className="mb-4 h-3 w-20 animate-pulse rounded-full bg-white/[0.06]" />
      <div className="mb-10 h-14 w-3/4 animate-pulse rounded-lg bg-white/[0.09]" />
      <div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 border-t border-[var(--line)] py-7 first:border-t-0 first:pt-0"
          >
            <div className="h-6 w-52 animate-pulse rounded-lg bg-white/[0.08]" />
            <div className="h-4 w-full animate-pulse rounded-lg bg-white/[0.05]" />
            <div className="h-4 w-11/12 animate-pulse rounded-lg bg-white/[0.05]" />
            <div className="h-4 w-3/4 animate-pulse rounded-lg bg-white/[0.05]" />
          </div>
        ))}
        <div className="border-t border-[var(--line)] pt-6">
          <div className="h-3 w-48 animate-pulse rounded bg-white/[0.05]" />
        </div>
      </div>
    </div>
  )
}
