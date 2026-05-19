const typographyRoles = [
  {
    role: 'Display (title)',
    spec: 'LBC · 56 / 600 / 1.0',
    sizeClass: 'text-5xl md:text-6xl font-display',
    weightClass: 'font-semibold',
    lineHeightClass: 'leading-[0.98]',
    sample: 'Quiet shell. Heroic content.',
  },
  {
    role: 'Section heading (title)',
    spec: 'LBC · 32 / 600 / 1.05',
    sizeClass: 'text-3xl font-display',
    weightClass: 'font-semibold',
    lineHeightClass: 'leading-tight',
    sample: 'Discover original shows',
  },
  {
    role: 'Body',
    spec: 'Geist (EN) · LBC Bold (AR) · 16 / 700 / 1.7',
    sizeClass: 'text-base',
    weightClass: 'font-normal',
    lineHeightClass: 'leading-7',
    sample:
      'Body copy stays clean, neutral, and airy. Geist drives English surfaces and LBC Bold handles Arabic so both locales feel like one product.',
  },
  {
    role: 'Label',
    spec: '12 / 500 / tracked',
    sizeClass: 'text-sm',
    weightClass: 'font-medium',
    lineHeightClass: 'leading-snug uppercase tracking-[0.24em]',
    sample: 'Featured now',
  },
  {
    role: 'Meta',
    spec: '14 / 400 / 1.5',
    sizeClass: 'text-sm',
    weightClass: 'font-normal',
    lineHeightClass: 'leading-6',
    sample: 'Season 1 · 12 episodes · 25 min',
  },
]

export default function TypographyPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[12px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          {'Type system'}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-[12px] border border-white/10 bg-black/20 p-5">
            <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
              Titles · all locales
            </p>
            <p className="text-foreground font-display mt-3 text-lg">LBC</p>
          </div>
          <div className="rounded-[12px] border border-white/10 bg-black/20 p-5">
            <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
              Body · English
            </p>
            <p className="text-foreground mt-3 text-lg">Geist</p>
          </div>
          <div className="rounded-[12px] border border-white/10 bg-black/20 p-5">
            <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
              Body · Arabic
            </p>
            <p className="text-foreground font-display mt-3 text-lg font-bold">LBC Bold</p>
          </div>
        </div>
      </section>

      <section className="rounded-[12px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Scale
        </h2>
        <div className="mt-8 space-y-8">
          {typographyRoles.map((role) => (
            <div key={role.role}>
              <p className="text-muted-foreground font-mono text-xs tracking-[0.24em] uppercase">
                {role.role} · {role.spec}
              </p>
              <p
                className={`text-foreground mt-3 ${role.sizeClass} ${role.weightClass} ${role.lineHeightClass}`}
              >
                {role.sample}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
