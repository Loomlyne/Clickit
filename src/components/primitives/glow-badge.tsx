interface GlowBadgeProps {
  label: string
  color: string
  pulse?: boolean
  className?: string
}

export function GlowBadge({
  label,
  color,
  pulse = false,
  className,
}: GlowBadgeProps) {
  // Build hex opacity variants from the full-opacity hex color
  // color is expected as a 6-char hex like "#2C3569"
  const bg = `${color}20`
  const border = `${color}40`

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold${pulse ? 'animate-glow-pulse' : ''}${className ? ` ${className}` : ''}`}
      style={{
        background: bg,
        color: color,
        border: `1px solid ${border}`,
      }}
    >
      {label}
    </span>
  )
}
