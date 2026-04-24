const FEATURES = [
  {
    n: '01',
    h: 'Editors, not algorithms.',
    b: 'Every show on Clickit is picked by a human. You won\'t find a recommendation engine pushing you toward six more things about the same thing.',
  },
  {
    n: '02',
    h: 'Independent creators, proper budget.',
    b: 'We partner with filmmakers directly and pay them per stream, not per view-time. That means 35-minute episodes that take 35 minutes to watch.',
  },
  {
    n: '03',
    h: 'Original content from Abu Dhabi.',
    b: 'Travel, health, music, comedy, cooking, kids, poetry, cinema, tech — 15 original programs produced from the UAE by Spacelight Studios.',
  },
]

export function WhySection() {
  return (
    <section className="mx-auto max-w-[1400px] px-10 py-24 border-t border-[var(--line)]" id="features">
      <div className="grid grid-cols-1 items-start gap-20 md:grid-cols-2">
        <div>
          <div className="mono mb-3.5 text-[var(--text-mute)]">003 · Why Clickit</div>
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] font-normal leading-none tracking-[-0.02em]">
            Slow TV for fast cities.
          </h2>
        </div>
        <div className="flex flex-col gap-8">
          {FEATURES.map((f) => (
            <div
              key={f.n}
              className="grid grid-cols-[60px_1fr] gap-5 border-b border-[var(--line)] pb-8"
            >
              <div className="mono text-[13px] text-[var(--primary)]">{f.n}</div>
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-[28px] font-normal tracking-[-0.01em] mb-2.5">
                  {f.h}
                </h3>
                <p className="text-[15px] leading-relaxed text-[var(--text-dim)]">{f.b}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
