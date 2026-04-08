import { ScrollReveal } from '@/components/primitives/scroll-reveal'

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

const STATS = [
  { value: '15', label: 'Original Programs' },
  { value: '2', label: 'Languages (AR & EN)' },
  { value: 'Abu Dhabi', label: 'Produced in the UAE' },
  { value: 'Free', label: 'No subscription required' },
]

export function BrandStats() {
  return (
    <ScrollReveal>
      <div className="px-6 md:px-12">
        {/* 6-color brand bar */}
        <div className="mb-4 flex h-1 overflow-hidden rounded-full" aria-hidden="true">
          {BRAND_COLORS.map((color) => (
            <div key={color} className="flex-1" style={{ background: color }} />
          ))}
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.03] px-8 py-12 shadow-[0_32px_90px_rgba(0,0,0,0.28)] backdrop-blur-md md:px-16 md:py-16">
          <p className="mb-10 text-[11px] font-medium uppercase tracking-[0.28em] text-white/38">
            About the Platform
          </p>

          <div className="flex flex-wrap gap-x-16 gap-y-10">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <p
                  className="font-display font-semibold leading-none text-white"
                  style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)' }}
                >
                  {value}
                </p>
                <p className="mt-2 text-sm font-medium uppercase tracking-[0.14em] text-white/48">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-sm text-white/28">
            Content from Spacelight Studios FZ LLC · Abu Dhabi, UAE
          </p>
        </div>
      </div>
    </ScrollReveal>
  )
}
