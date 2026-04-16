import Image from 'next/image'
import { getHeroVideo } from '@/lib/queries'
import { extractYouTubeId } from '@/lib/youtube'
import { LandingHeroAnimations } from './landing-hero-animations'

export async function LandingHero() {
  const heroVideo = await getHeroVideo()
  const youtubeId = heroVideo?.type === 'youtube' ? extractYouTubeId(heroVideo.url) : null

  return (
    <section className="relative -mt-24 min-h-dvh overflow-hidden md:-mt-28">
      {/* Video / Fallback background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[#05070B]" />

        {/* Video layer */}
        {heroVideo?.type === 'mp4' && (
          <video
            src={heroVideo.url}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-cover opacity-50"
          />
        )}
        {heroVideo?.type === 'youtube' && youtubeId && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`}
              allow="autoplay; encrypted-media"
              className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 border-none"
              style={{ aspectRatio: '16/9', opacity: 0.5 }}
              title="Hero background video"
            />
          </div>
        )}

        {/* Ambient glow — always present */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(circle at 50% 30%, rgba(109,112,241,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Bottom vignette */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/40 to-transparent" />

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

      {/* Centered content */}
      <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 pt-20 md:px-12">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <LandingHeroAnimations>
            <Image
              src="/brand/Clickit_final_logo.svg"
              alt="Clickit Story"
              width={480}
              height={120}
              className="w-48 md:w-80"
              style={{ filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.1))' }}
              priority
            />
          </LandingHeroAnimations>
        </div>
      </div>

      {/* Bottom border */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/5" />
    </section>
  )
}
