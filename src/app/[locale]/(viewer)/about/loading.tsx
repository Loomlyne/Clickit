export default function AboutLoading() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-16 sm:px-6 md:px-10">
      {/* Eyebrow + title */}
      <div className="mb-3 h-3 w-24 animate-pulse rounded-full bg-white/[0.06]" />
      <div className="mb-4 h-14 w-3/4 animate-pulse rounded-2xl bg-white/[0.09]" />
      <div className="mb-2 h-5 w-full animate-pulse rounded-lg bg-white/[0.06]" />
      <div className="mb-12 h-5 w-5/6 animate-pulse rounded-lg bg-white/[0.06]" />

      {/* 3 content sections */}
      <div className="space-y-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-6 w-48 animate-pulse rounded-xl bg-white/[0.08]" />
            <div className="h-4 w-full animate-pulse rounded-lg bg-white/[0.05]" />
            <div className="h-4 w-11/12 animate-pulse rounded-lg bg-white/[0.05]" />
            <div className="h-4 w-4/5 animate-pulse rounded-lg bg-white/[0.05]" />
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-12 h-12 w-40 animate-pulse rounded-full bg-white/[0.08]" />
    </div>
  )
}
