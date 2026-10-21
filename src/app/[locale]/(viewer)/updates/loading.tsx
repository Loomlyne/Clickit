export default function UpdatesLoading() {
  return (
    <div className="px-4 pt-8 pb-16 sm:px-6 md:px-12">
      <div className="mx-auto max-w-3xl rounded-card border border-white/[0.08] bg-[var(--bg-1)] p-6 sm:p-10">
        <div className="mb-4 h-3 w-20 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="h-14 w-3/4 animate-pulse rounded-lg bg-white/[0.09]" />
        <div className="mt-4 h-5 w-full animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="mt-2 h-5 w-4/5 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="h-11 w-full animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-11 w-40 animate-pulse rounded-full bg-white/[0.10]" />
        </div>
      </div>
    </div>
  )
}
