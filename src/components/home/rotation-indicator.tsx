'use client'

interface RotationIndicatorProps {
  activeIndex: number
  total: number
  progress: number
  /** Hex color of the active show's brand color for progress fill */
  activeColor?: string
}

export function RotationIndicator({
  activeIndex,
  total,
  progress,
  activeColor = '#ffffff',
}: RotationIndicatorProps) {
  return (
    <div
      className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 gap-2"
      aria-label={`Show ${activeIndex + 1} of ${total}`}
      role="progressbar"
      aria-valuenow={activeIndex + 1}
      aria-valuemin={1}
      aria-valuemax={total}
    >
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          className="relative w-12 h-0.5 bg-white/20 rounded-full overflow-hidden"
        >
          {index === activeIndex && (
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-none"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: activeColor,
                transition: 'width 100ms linear',
              }}
            />
          )}
          {index < activeIndex && (
            <div
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
