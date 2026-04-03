const typographyRoles = [
  {
    role: 'DISPLAY',
    spec: '48PX / BOLD / 1.1',
    sizeClass: 'text-5xl',
    weightClass: 'font-bold',
    lineHeightClass: 'leading-none',
    sample: 'Clickit Story',
  },
  {
    role: 'HEADING',
    spec: '24PX / BOLD / 1.2',
    sizeClass: 'text-2xl',
    weightClass: 'font-bold',
    lineHeightClass: 'leading-tight',
    sample: 'Discover Original Shows',
  },
  {
    role: 'BODY',
    spec: '16PX / REGULAR / 1.5',
    sizeClass: 'text-base',
    weightClass: 'font-normal',
    lineHeightClass: 'leading-relaxed',
    sample:
      'Explore our collection of original programs spanning travel, health, music, comedy, cooking, and more. Each show is crafted with care in Abu Dhabi by Spacelight Studios.',
  },
  {
    role: 'LABEL',
    spec: '14PX / REGULAR / 1.4',
    sizeClass: 'text-sm',
    weightClass: 'font-normal',
    lineHeightClass: 'leading-snug',
    sample: 'Season 1 \u2014 12 Episodes \u2014 25 min',
  },
]

export default function TypographyPage() {
  return (
    <div className="space-y-12">
      {/* Font Stack Info */}
      <section className="rounded-lg border border-border bg-surface-1 p-6">
        <h2 className="text-xl font-bold text-foreground">Font Stack</h2>
        <div className="mt-3 space-y-1 font-mono text-sm text-text-secondary">
          <p>
            <span className="text-text-muted">Current font:</span> Inter
            (placeholder for PP Neue Montreal)
          </p>
          <p>
            <span className="text-text-muted">Weights loaded:</span> 400
            (Regular), 700 (Bold)
          </p>
          <p>
            <span className="text-text-muted">Fallback:</span> system-ui,
            -apple-system, sans-serif
          </p>
        </div>
      </section>

      {/* Typography Scale */}
      <section className="space-y-8">
        <h2 className="text-xl font-bold text-foreground">Typography Scale</h2>
        {typographyRoles.map((role) => (
          <div key={role.role}>
            <p className="font-mono text-xs uppercase tracking-wider text-text-muted">
              {role.role} &mdash; {role.spec}
            </p>
            <p
              className={`mt-2 text-foreground ${role.sizeClass} ${role.weightClass} ${role.lineHeightClass}`}
            >
              {role.sample}
            </p>
          </div>
        ))}
      </section>
    </div>
  )
}
