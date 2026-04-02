interface ShowArtProps {
  brandColor: string;
  title: string;
  aspectRatio?: string;
  children?: React.ReactNode;
  className?: string;
}

export function ShowArt({
  brandColor,
  title,
  aspectRatio = '16/9',
  children,
  className,
}: ShowArtProps) {
  const watermarkWord = title.split(' ')[0] ?? title;

  return (
    <div
      className={`relative overflow-hidden${className ? ` ${className}` : ''}`}
      style={{ aspectRatio }}
    >
      {/* Layer 1: brand color background */}
      <div
        className="absolute inset-0"
        style={{ background: brandColor }}
      />

      {/* Layer 2: cinema gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      {/* Layer 3: watermark text */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        aria-hidden="true"
      >
        <span
          style={{
            fontSize: 'clamp(3rem, 15vw, 10rem)',
            fontWeight: 900,
            color: 'white',
            opacity: 0.08,
            userSelect: 'none',
            pointerEvents: 'none',
            letterSpacing: '-0.05em',
            textTransform: 'uppercase',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {watermarkWord.toUpperCase()}
        </span>
      </div>

      {/* Layer 4: children content overlay */}
      {children && (
        <div className="absolute inset-0">
          {children}
        </div>
      )}
    </div>
  );
}
