"use client";

import Image from 'next/image'
import { extractYouTubeId } from '@/lib/youtube'

interface CinematicBackdropProps {
  brandColor: string;
  intensity?: 'low' | 'medium' | 'high';
  watermarkText?: string;
  className?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  videoUrl?: string;
  videoType?: 'mp4' | 'youtube';
  mobileVideoUrl?: string;
  mobileVideoType?: 'mp4' | 'youtube';
}

function VideoLayer({ url, type, className }: { url: string; type: 'mp4' | 'youtube'; className: string }) {
  if (type === 'mp4') {
    return (
      <video
        src={url}
        autoPlay
        muted
        loop
        playsInline
        className={className}
        aria-hidden
      />
    )
  }
  const videoId = extractYouTubeId(url)
  if (!videoId) return null
  return (
    <iframe
      src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&rel=0&showinfo=0&iv_load_type=3&modestbranding=1`}
      allow="autoplay"
      className={className}
      aria-hidden
    />
  )
}

export function CinematicBackdrop({
  brandColor,
  intensity = 'medium',
  watermarkText,
  className,
  imageUrl,
  mobileImageUrl,
  videoUrl,
  videoType,
  mobileVideoUrl,
  mobileVideoType,
}: CinematicBackdropProps) {
  const bloomAlpha = intensity === 'low' ? '40' : intensity === 'high' ? '80' : '55';

  // Desktop media: desktop video > desktop image
  // Mobile media: mobile video > desktop video (fallback) > mobile image > desktop image
  const desktopHasVideo = !!(videoUrl && videoType)
  const mobileHasVideo = !!(mobileVideoUrl && mobileVideoType)
  const mobileUsesDesktopVideo = !mobileHasVideo && desktopHasVideo

  return (
    <div className={`absolute inset-0 overflow-hidden${className ? ` ${className}` : ''}`}>
      {/* Layer 1: solid black base */}
      <div className="absolute inset-0 bg-black" />

      {/* Layer 2: hero media — desktop */}
      {desktopHasVideo ? (
        <VideoLayer
          url={videoUrl!}
          type={videoType!}
          className="absolute inset-0 hidden h-full w-full scale-110 object-cover opacity-80 pointer-events-none md:block"
        />
      ) : imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          className="hidden object-cover opacity-80 md:block"
          sizes="100vw"
          priority
          aria-hidden
        />
      ) : null}

      {/* Layer 2: hero media — mobile */}
      {mobileHasVideo ? (
        <VideoLayer
          url={mobileVideoUrl!}
          type={mobileVideoType!}
          className="absolute inset-0 block h-full w-full scale-110 object-cover opacity-80 pointer-events-none md:hidden"
        />
      ) : mobileUsesDesktopVideo ? (
        <VideoLayer
          url={videoUrl!}
          type={videoType!}
          className="absolute inset-0 block h-full w-full scale-110 object-cover opacity-80 pointer-events-none md:hidden"
        />
      ) : mobileImageUrl ? (
        <Image
          src={mobileImageUrl}
          alt=""
          fill
          className="block object-cover opacity-80 md:hidden"
          sizes="100vw"
          priority
          aria-hidden
        />
      ) : imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          className="block object-cover opacity-80 md:hidden"
          sizes="100vw"
          priority
          aria-hidden
        />
      ) : null}

      {/* Layer 3: radial gradient bloom using brand color */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 120%, ${brandColor}${bloomAlpha} 0%, transparent 70%)`,
        }}
      />

      {/* Layer 4: watermark text (optional, only when no image) */}
      {watermarkText && !imageUrl && (
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

      {/* Layer 5: subtle noise texture */}
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
