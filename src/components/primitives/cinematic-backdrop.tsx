"use client";

interface CinematicBackdropProps {
  brandColor: string;
  intensity?: 'low' | 'medium' | 'high';
  watermarkText?: string;
  className?: string;
}

export function CinematicBackdrop({
  brandColor,
  intensity = 'medium',
  watermarkText,
  className,
}: CinematicBackdropProps) {
  const bloomAlpha = intensity === 'low' ? '40' : intensity === 'high' ? '80' : '55';

  return (
    <div className={`absolute inset-0 overflow-hidden${className ? ` ${className}` : ''}`}>
      {/* Layer 1: solid black base */}
      <div className="absolute inset-0 bg-black" />

      {/* Layer 2: radial gradient bloom using brand color */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 120%, ${brandColor}${bloomAlpha} 0%, transparent 70%)`,
        }}
      />

      {/* Layer 3: watermark text (optional) */}
      {watermarkText && (
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          aria-hidden="true"
        >
          <span
            style={{
              fontSize: 'clamp(8rem, 20vw, 18rem)',
              fontWeight: 800,
              color: 'white',
              opacity: 0.03,
              userSelect: 'none',
              pointerEvents: 'none',
              textTransform: 'uppercase',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {watermarkText.toUpperCase()}
          </span>
        </div>
      )}

      {/* Layer 4: subtle noise texture */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
          backgroundSize: '256px',
          opacity: 0.4,
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}
