import Image from 'next/image'
import Link from 'next/link'
import { getHeroVideo } from '@/lib/queries'
import { extractYouTubeId } from '@/lib/youtube'
import { LandingHeroAnimations } from './landing-hero-animations'

const BRAND_COLORS = ['#2C3569', '#9F54A0', '#50A258', '#DB3F34', '#EA8C2E', '#F8C623']

export async function LandingHero() {
  const heroVideo = await getHeroVideo()
  const youtubeId = heroVideo?.type === 'youtube' ? extractYouTubeId(heroVideo.url) : null

  return (
    <section className="relative -mt-24 h-dvh overflow-hidden md:-mt-28">
      {/* Video / Fallback background */}
      <div className="absolute inset-0">
        {/* Layer 1: black base */}
        <div className="absolute inset-0 bg-black" />

        {/* Layer 2: video */}
        {/* preload="metadata" tells the browser to download only the first ~1s of
            video data for dimensions/duration, not the whole file, before the user
            even sees anything. The full stream then loads as playback needs it.
            This saves ~hundreds of KB on mobile first paint. */}
        {heroVideo?.type === 'mp4' && (
          <video
            src={heroVideo.url}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
        )}
        {heroVideo?.type === 'youtube' && youtubeId && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`}
              allow="autoplay; encrypted-media"
              className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 border-none"
              style={{ aspectRatio: '16/9', opacity: 0.6 }}
              title="Hero background video"
            />
          </div>
        )}

        {/* Fallback: gradient bloom when no video */}
        {!heroVideo && (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse 80% 60% at 50% 120%, rgba(96,115,255,0.5) 0%, transparent 70%)',
              }}
            />
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
                CIT
              </span>
            </div>
          </>
        )}

        {/* Layer 3: cinematic overlays (always present) */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 10% 20%, rgba(96,115,255,0.18) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(159,84,160,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Bottom vignette */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06070A] via-black/30 to-transparent" />

        {/* Noise texture */}
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

      {/* Content */}
      <div className="absolute bottom-0 left-0 w-full px-6 pb-16 md:px-12 md:pb-20">
        <div className="max-w-[52rem]">
          <LandingHeroAnimations>
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit Story"
              width={480}
              height={120}
              className="h-[5.25rem] w-auto md:h-[7.5rem]"
              priority
            />
          </LandingHeroAnimations>
        </div>
      </div>

      {/* Decorative 6-color brand bar at the very bottom */}
      <div className="absolute inset-x-0 bottom-0 flex h-0.5 opacity-40" aria-hidden="true">
        {BRAND_COLORS.map((color) => (
          <div key={color} className="flex-1" style={{ background: color }} />
        ))}
      </div>
    </section>
  )
}
