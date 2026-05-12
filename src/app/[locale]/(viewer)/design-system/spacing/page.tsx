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
    <div className="space-y-8">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{'Spacing scale'}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The system uses a 4px rhythm, but the redesign leans most heavily on 16, 24, 32, and 48 for cards, section spacing, and dense admin layout.
        </p>
        <div className="mt-6 space-y-4">
          {spacingTokens.map((token) => (
            <div key={token.name} className="flex items-center gap-4 rounded-[28px] border border-white/10 bg-black/20 px-4 py-4">
              <span className="w-10 font-mono text-sm text-muted-foreground">
                {token.name}
              </span>
              <span className="w-12 font-mono text-sm text-muted-foreground">
                {token.value}
              </span>
              <div className={`${token.barWidth} h-4 rounded-sm bg-primary`} />
              <div
                className={`${token.boxSize} rounded-sm bg-white`}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Radius rules
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 text-sm text-muted-foreground">12px for buttons and inputs</div>
            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 text-sm text-muted-foreground">20px for nested cards</div>
            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 text-sm text-muted-foreground">28px for page-level panels</div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Touch target
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            44px remains the floor for mobile interactions. Dense admin layouts can be visually tighter, but active targets should still meet touch requirements.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-[28px] border-2 border-dashed border-primary/60 bg-black/20">
              <span className="font-mono text-xs text-muted-foreground">44</span>
            </div>
            <span className="font-mono text-sm text-muted-foreground">44 x 44px minimum</span>
          </div>
        </div>
      </section>
    </div>
  )
}
