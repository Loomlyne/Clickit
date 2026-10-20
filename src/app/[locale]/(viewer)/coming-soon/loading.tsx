export default function ComingSoonLoading() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--nav-h))] flex-col items-center justify-center px-6 py-16">
      <div className="h-[150px] w-[min(72vw,320px)] animate-pulse rounded-[11px] bg-white/[0.06]" />
      <div className="mt-10 h-3 w-28 animate-pulse rounded-full bg-white/[0.06]" />
      <div className="mt-4 h-14 w-[min(80vw,420px)] animate-pulse rounded-lg bg-white/[0.09]" />
      <div className="mt-5 h-4 w-[min(70vw,360px)] animate-pulse rounded-lg bg-white/[0.06]" />
      <div className="mt-2 h-4 w-[min(55vw,260px)] animate-pulse rounded-lg bg-white/[0.06]" />
    </div>
  )
}
