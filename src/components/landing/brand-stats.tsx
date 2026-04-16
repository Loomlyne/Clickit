import { ScrollReveal } from '@/components/primitives/scroll-reveal'

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

const STATS = [
  { label: 'Library', value: '15', suffix: '+', description: 'Exclusive Originals' },
  { label: 'Audio', value: '2', suffix: '', description: 'Immersive Languages' },
  { label: 'Origin', value: 'Abu Dhabi', suffix: '', description: 'Produced in the UAE' },
  { label: 'Access', value: 'Free', suffix: '', description: 'No subscription required' },
]

export function BrandStats() {
  return (
    <ScrollReveal>
      <div className="px-6 md:px-12">
        <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          {/* 6-color brand accent bar */}
          <div className="absolute inset-x-0 top-0 flex h-[3px]" aria-hidden="true">
            {BRAND_COLORS.map((color) => (
              <div key={color} className="flex-1" style={{ background: color }} />
            ))}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 divide-y divide-white/10 p-8 sm:grid-cols-2 sm:divide-x sm:divide-y-0 md:p-12 lg:grid-cols-4">
            {STATS.map(({ label, value, suffix, description }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center rounded-2xl p-6 text-center transition-colors hover:bg-white/[0.02] lg:p-4"
              >
                <span className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
                  {label}
                </span>
                <div className="flex items-baseline gap-1">
                  <span
                    className="font-display font-black leading-none text-white"
                    style={{
                      fontSize: value.length > 3 ? 'clamp(1.8rem, 4vw, 2.5rem)' : 'clamp(3rem, 5vw, 3.75rem)',
                      letterSpacing: '-0.04em',
                    }}
                  >
                    {value}
                  </span>
                  {suffix && (
                    <span className="text-2xl font-bold tracking-tight text-brand-orange">
                      {suffix}
                    </span>
                  )}
                </div>
                <span className="mt-2 text-sm font-medium text-white/52">
                  {description}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollReveal>
  )
}
