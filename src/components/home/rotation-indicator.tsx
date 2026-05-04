// Hero dots — vertical column on right side, matches handoff .hero-dots
'use client'

interface HeroDotsProps {
  activeIndex: number
  total: number
  intervalMs: number
  isPaused: boolean
  onSelect: (index: number) => void
}

export function HeroDots({
  activeIndex,
  total,
  intervalMs,
  isPaused,
  onSelect,
}: HeroDotsProps) {
  return (
    <div
      className="absolute end-10 bottom-[100px] z-[2] hidden flex-col gap-2.5 md:flex"
      aria-label={`Show ${activeIndex + 1} of ${total}`}
      role="progressbar"
      aria-valuenow={activeIndex + 1}
      aria-valuemin={1}
      aria-valuemax={total}
    >
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          onClick={() => onSelect(index)}
          className="relative w-[3px] cursor-pointer overflow-hidden rounded-full bg-white/20 transition-all duration-200 ease-[var(--ease)]"
          style={{ height: index === activeIndex ? 60 : 28 }}
        >
          {index === activeIndex && (
            <div
              key={`fill-${activeIndex}`}
              className="absolute inset-x-0 top-0 w-full bg-[var(--accent)]"
              style={{
                transformOrigin: 'top',
                animation: `heroDotFill ${intervalMs}ms linear forwards`,
                animationPlayState: isPaused ? 'paused' : 'running',
                height: '100%',
              }}
            />
          )}
          {index < activeIndex && (
            <div className="absolute inset-0 bg-white/50" />
          )}
        </div>
      ))}
    </div>
  )
}

// Keep old export name for backward compat
export { HeroDots as RotationIndicator }
