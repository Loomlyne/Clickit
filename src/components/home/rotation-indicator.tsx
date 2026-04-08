'use client'

interface RotationIndicatorProps {
  activeIndex: number
  total: number
  /** Duration in ms for the progress fill animation */
  intervalMs: number
  isPaused: boolean
  /** Hex color of the active show's brand color for progress fill */
  activeColor?: string
}

export function RotationIndicator({
  activeIndex,
  total,
  intervalMs,
  isPaused,
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
              key={`progress-${activeIndex}`}
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                backgroundColor: activeColor,
                animation: `progress-fill ${intervalMs}ms linear forwards`,
                animationPlayState: isPaused ? 'paused' : 'running',
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
