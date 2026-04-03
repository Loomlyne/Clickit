const spacingTokens = [
  { name: 'xs', value: '4px', barWidth: 'w-1', boxSize: 'w-1 h-1' },
  { name: 'sm', value: '8px', barWidth: 'w-2', boxSize: 'w-2 h-2' },
  { name: 'md', value: '16px', barWidth: 'w-4', boxSize: 'w-4 h-4' },
  { name: 'lg', value: '24px', barWidth: 'w-6', boxSize: 'w-6 h-6' },
  { name: 'xl', value: '32px', barWidth: 'w-8', boxSize: 'w-8 h-8' },
  { name: '2xl', value: '48px', barWidth: 'w-12', boxSize: 'w-12 h-12' },
  { name: '3xl', value: '64px', barWidth: 'w-16', boxSize: 'w-16 h-16' },
]

export default function SpacingPage() {
  return (
    <div className="space-y-12">
      {/* Spacing Scale */}
      <section>
        <h2 className="text-xl font-bold text-foreground">Spacing Scale</h2>
        <p className="mt-1 text-sm text-text-secondary">
          All spacing tokens are multiples of 4px for consistent rhythm.
        </p>
        <div className="mt-6 space-y-4">
          {spacingTokens.map((token) => (
            <div key={token.name} className="flex items-center gap-4">
              <span className="w-10 font-mono text-sm text-text-secondary">
                {token.name}
              </span>
              <span className="w-12 font-mono text-sm text-text-muted">
                {token.value}
              </span>
              <div className={`${token.barWidth} h-4 rounded-sm bg-brand-blue`} />
              <div
                className={`${token.boxSize} rounded-sm bg-brand-purple`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Touch Target */}
      <section>
        <h2 className="text-xl font-bold text-foreground">
          Touch Target (WCAG 2.5.8)
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          44px minimum touch target for interactive elements on mobile.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-dashed border-brand-blue-safe bg-surface-3">
            <span className="font-mono text-xs text-text-muted">44</span>
          </div>
          <span className="font-mono text-sm text-text-secondary">
            44 &times; 44px
          </span>
        </div>
      </section>
    </div>
  )
}
