const typographyRoles = [
  {
    role: 'Display',
    spec: '56 / 600 / 1.0',
    sizeClass: 'text-5xl md:text-6xl',
    weightClass: 'font-semibold',
    lineHeightClass: 'leading-[0.98]',
    sample: 'Quiet shell. Heroic content.',
  },
  {
    role: 'Section heading',
    spec: '32 / 600 / 1.05',
    sizeClass: 'text-3xl',
    weightClass: 'font-semibold',
    lineHeightClass: 'leading-tight',
    sample: 'Discover original shows',
  },
  {
    role: 'Body',
    spec: '16 / 400 / 1.7',
    sizeClass: 'text-base',
    weightClass: 'font-normal',
    lineHeightClass: 'leading-7',
    sample:
      'Body copy stays clean, neutral, and airy. Inter is used everywhere so viewer and admin surfaces feel like one product instead of two visual systems.',
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
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Type system</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Family</p>
            <p className="mt-3 text-lg text-foreground">Inter</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Weights</p>
            <p className="mt-3 text-lg text-foreground">400, 500, 600, 700</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Rule</p>
            <p className="mt-3 text-lg text-foreground">No decorative display font in the primary UI.</p>
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
