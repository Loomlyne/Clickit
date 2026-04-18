import Image from 'next/image'
import { extractYouTubeId } from '@/lib/youtube'
import { resolveHeroMedia, type HeroMediaChoice } from '@/lib/hero-media'

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
  /**
   * When set (server-side UA detection), renders only the matching variant
   * instead of both branches. Prevents the browser from downloading both
   * desktop and mobile media when only one is ever visible.
   * When undefined, falls back to CSS-based responsive rendering (both
   * branches mount, CSS hides one — used by auth pages which have no videos).
   */
  isMobile?: boolean;
  /**
   * When true, disables video autoplay (both <video> and YouTube iframe) in
   * respect of the user's prefers-reduced-motion OS setting. The video still
   * mounts but stays paused on its poster/first frame. YouTube iframes omit
   * the autoplay flag so they load without animating.
   */
  reducedMotion?: boolean;
}

function VideoLayer({
  url,
  type,
  className,
  reducedMotion,
}: {
  url: string
  type: 'mp4' | 'youtube'
  className: string
  reducedMotion?: boolean
}) {
  if (type === 'mp4') {
    return (
      <video
        src={url}
        autoPlay={!reducedMotion}
        muted
        loop={!reducedMotion}
        playsInline
        className={className}
        aria-hidden
      />
    )
  }
  const videoId = extractYouTubeId(url)
  if (!videoId) return null
  const autoplayFlag = reducedMotion ? '0' : '1'
  const loopFlag = reducedMotion ? '0' : '1'
  return (
    <iframe
      src={`https://www.youtube.com/embed/${videoId}?autoplay=${autoplayFlag}&mute=1&loop=${loopFlag}&playlist=${videoId}&controls=0&rel=0&showinfo=0&iv_load_type=3&modestbranding=1`}
      allow="autoplay"
      title="Hero background"
      className={className}
      aria-hidden
    />
  )
}

// Resolution logic lives in src/lib/hero-media.ts so it's unit-testable without
// React. Type alias re-exported here for local readability.
type MediaChoice = HeroMediaChoice

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
  isMobile,
  reducedMotion,
}: CinematicBackdropProps) {
  const bloomAlpha = intensity === 'low' ? '40' : intensity === 'high' ? '80' : '55';

  // Server-side viewport-aware rendering: when isMobile is resolved upstream,
  // render ONLY the matching variant. Prevents double-download of desktop +
  // mobile media on mobile devices.
  const useServerViewport = typeof isMobile === 'boolean'
  const resolved: MediaChoice = useServerViewport
    ? resolveHeroMedia(isMobile, {
        videoUrl,
        videoType,
        mobileVideoUrl,
        mobileVideoType,
        imageUrl,
        mobileImageUrl,
      })
    : null

  // Fallback path (auth pages etc. — no isMobile threaded, no videos): keep
  // CSS-responsive two-branch rendering for backward compatibility.
  const desktopHasVideo = !!(videoUrl && videoType)
  const mobileHasVideo = !!(mobileVideoUrl && mobileVideoType)
  const mobileUsesDesktopVideo = !mobileHasVideo && desktopHasVideo

  return (
    <div className={`absolute inset-0 overflow-hidden${className ? ` ${className}` : ''}`}>
      {/* Layer 1: solid black base */}
      <div className="absolute inset-0 bg-black" />

      {useServerViewport ? (
        /* Viewport-aware: single variant, no CSS hiding needed */
        resolved?.kind === 'video' ? (
          <VideoLayer
            url={resolved.url}
            type={resolved.type}
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-80 pointer-events-none"
            reducedMotion={reducedMotion}
          />
        ) : resolved?.kind === 'image' ? (
          <Image
            src={resolved.url}
            alt=""
            fill
            className="object-cover opacity-80"
            sizes="100vw"
            priority
            aria-hidden
          />
        ) : null
      ) : (
        <>
          {/* Legacy CSS-responsive path: desktop branch */}
          {desktopHasVideo ? (
            <VideoLayer
              url={videoUrl!}
              type={videoType!}
              className="absolute inset-0 hidden h-full w-full scale-110 object-cover opacity-80 pointer-events-none md:block"
              reducedMotion={reducedMotion}
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

          {/* Legacy CSS-responsive path: mobile branch */}
          {mobileHasVideo ? (
            <VideoLayer
              url={mobileVideoUrl!}
              type={mobileVideoType!}
              className="absolute inset-0 block h-full w-full scale-110 object-cover opacity-80 pointer-events-none md:hidden"
              reducedMotion={reducedMotion}
            />
          ) : mobileUsesDesktopVideo ? (
            <VideoLayer
              url={videoUrl!}
              type={videoType!}
              className="absolute inset-0 block h-full w-full scale-110 object-cover opacity-80 pointer-events-none md:hidden"
              reducedMotion={reducedMotion}
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
        </>
      )}

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
