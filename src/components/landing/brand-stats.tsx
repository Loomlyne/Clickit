import { ScrollReveal } from '@/components/primitives/scroll-reveal'

const STATS = [
  { label: 'Library', value: '15', suffix: '+', description: 'Exclusive Originals' },
  { label: 'Audio', value: '2', suffix: '', description: 'Immersive Languages' },
  { label: 'Origin', value: 'Abu\nDhabi', suffix: '', description: 'Produced in the UAE', small: true },
  { label: 'Access', value: 'Free', suffix: '', description: 'No subscription required', small: true },
]

export function BrandStats() {
  return (
    <ScrollReveal>
      <div className="px-6 md:px-12">
        {/* Gradient accent line */}
        <div
          className="mb-0 h-px w-full opacity-30"
          aria-hidden="true"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(109,112,241,0.6), transparent)' }}
        />

        {/* Sharp-edged grid with gap-px dividers */}
        <div className="grid grid-cols-2 gap-px overflow-hidden bg-white/5 md:grid-cols-4"
          style={{ backdropFilter: 'blur(24px)', background: 'rgba(15,17,21,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          {STATS.map(({ label, value, suffix, description, small }) => (
            <div
              key={label}
              className="group flex flex-col justify-between bg-[#05070B]/80 p-8 transition-colors hover:bg-[#05070B] md:p-12"
            >
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                  {label}
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span
                    className={`font-display font-light tracking-tighter text-white ${
                      small ? 'text-3xl md:text-4xl' : 'text-5xl md:text-7xl'
                    }`}
                    style={value.includes('\n') ? { lineHeight: 1, whiteSpace: 'pre-line' } : undefined}
                  >
                    {value}
                  </span>
                  {suffix && (
                    <span className="text-2xl font-medium text-primary">{suffix}</span>
                  )}
                </div>
              </div>
              <p className="mt-4 text-sm text-white/40 transition-colors group-hover:text-white">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </ScrollReveal>
  )
}
