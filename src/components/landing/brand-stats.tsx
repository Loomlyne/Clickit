export function BrandStats() {
  const stats = [
    { n: '15', l: 'Original shows' },
    { n: '294', l: 'Episodes streaming' },
    { n: 'UAE', l: 'Abu Dhabi produced' },
    { n: 'Free', l: 'No subscription' },
  ]

  return (
    <section className="grid grid-cols-2 border-y border-[var(--line)] bg-[var(--bg-1)] md:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.l}
          className="flex flex-col gap-2.5 border-e border-[var(--line)] px-8 py-10 last:border-e-0"
        >
          <div className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,56px)] font-normal leading-none tracking-[-0.02em]">
            {s.n}
          </div>
          <div className="mono">{s.l}</div>
        </div>
      ))}
    </section>
  )
}
