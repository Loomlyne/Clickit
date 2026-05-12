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
    spec: 'Geist (EN) · GE SS (AR) · 16 / 400 / 1.7',
    sizeClass: 'text-base',
    weightClass: 'font-normal',
    lineHeightClass: 'leading-7',
    sample:
      'Body copy stays clean, neutral, and airy. Geist drives English surfaces and GE SS handles Arabic so both locales feel like one product.',
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
      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{'Type system'}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Titles · all locales</p>
            <p className="mt-3 text-lg text-foreground font-display">LBC</p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Body · English</p>
            <p className="mt-3 text-lg text-foreground">Geist</p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Body · Arabic</p>
            <p className="mt-3 text-lg text-foreground">GE SS</p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Scale</h2>
        <div className="mt-8 space-y-8">
        {typographyRoles.map((role) => (
          <div key={role.role}>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
              {role.role} · {role.spec}
            </p>
            <p
              className={`mt-3 text-foreground ${role.sizeClass} ${role.weightClass} ${role.lineHeightClass}`}
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
