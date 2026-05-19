import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAppConfig } from '@/lib/config'
import { extractYouTubeId } from '@/lib/youtube'

// Fallback cinematic reel — admin can override via Settings → Branding → Hero video
const FALLBACK_YT_ID = 'Nk2jlxVX8g8'

export async function LandingHero() {
  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    config,
    t,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getAppConfig(),
    getTranslations('landing'),
  ])
  const ctaHref = user ? '/watch' : '/auth'

  const { heroVideoUrl, heroVideoType } = config
  const adminYtId =
    heroVideoType === 'youtube' && heroVideoUrl
      ? extractYouTubeId(heroVideoUrl)
      : null
  const ytId = adminYtId ?? (heroVideoType === 'mp4' ? null : FALLBACK_YT_ID)

  return (
    <section className="relative -mt-16 min-h-dvh overflow-hidden">
      {heroVideoType === 'mp4' && heroVideoUrl && (
        <video
          src={heroVideoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}

      {ytId && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&disablekb=1&fs=0&cc_load_policy=0`}
            allow="autoplay; encrypted-media"
            className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{
              width: '177.78dvh',
              minWidth: '100vw',
              height: '56.25vw',
              minHeight: '100dvh',
            }}
            title={t('heroBackgroundTitle')}
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black from-10% via-black/50 via-40% to-transparent" />

      <div className="relative flex min-h-dvh items-end px-4 pt-28 pb-16 sm:px-6 md:px-10 md:pb-20">
        <div className="w-full max-w-[560px]">
          <Image
            src={config.ogImageUrl ?? '/brand/Clickit_final_logo.svg'}
            alt="Clickit Story"
            width={280}
            height={72}
            priority
            unoptimized={!!config.ogImageUrl}
            className="mb-6 h-auto w-48 sm:w-56 md:w-64"
          />
          <p className="mb-9 text-[17px] leading-relaxed text-[var(--text-dim)]">
            {t('heroDescription')}
          </p>
          <div className="mb-12 md:mb-16">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-[14px] font-medium uppercase tracking-[0.06em] whitespace-nowrap text-[var(--primary-foreground)] transition-all hover:bg-white sm:px-6 sm:py-3.5 sm:text-[15px]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              {t('heroCta')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
