export default function PrivacyLoading() {
  return (
    <main className="mx-auto max-w-[860px] px-4 py-24 sm:px-6 md:px-10">
      <div className="mb-4 h-3 w-20 animate-pulse rounded-full bg-white/[0.06]" />
      <div className="mb-12 h-16 w-3/4 animate-pulse rounded-2xl bg-white/[0.09]" />
      <div className="space-y-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-6 w-52 animate-pulse rounded-xl bg-white/[0.08]" />
            <div className="h-4 w-full animate-pulse rounded-lg bg-white/[0.05]" />
            <div className="h-4 w-11/12 animate-pulse rounded-lg bg-white/[0.05]" />
            <div className="h-4 w-3/4 animate-pulse rounded-lg bg-white/[0.05]" />
          </div>
        ))}
        <div className="border-t border-white/[0.06] pt-8">
          <div className="h-3 w-48 animate-pulse rounded bg-white/[0.05]" />
        </div>
      </div>
    </main>
  )
}
