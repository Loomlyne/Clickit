'use client'

interface RotationIndicatorProps {
  activeIndex: number
  total: number
  progress: number
}

export function RotationIndicator({
  activeIndex,
  total,
  progress,
}: RotationIndicatorProps) {
  return (
    <div
      className="absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 gap-2"
      aria-label={`Show ${activeIndex + 1} of ${total}`}
      role="progressbar"
      aria-valuenow={activeIndex + 1}
      aria-valuemin={1}
      aria-valuemax={total}
    >
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          className="h-[3px] w-[30px] overflow-hidden rounded-full bg-text-muted/40"
        >
          <div
            className="h-full bg-primary-foreground"
            style={{
              width:
                index < activeIndex
                  ? '100%'
                  : index === activeIndex
                    ? `${progress * 100}%`
                    : '0%',
              transition: index === activeIndex ? 'width 100ms linear' : 'none',
            }}
          />
        </div>
      ))}
    </div>
  )
}
