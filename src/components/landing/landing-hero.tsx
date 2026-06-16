import Image from 'next/image'
import { getTranslations, getLocale } from 'next-intl/server'
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
    locale,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getAppConfig(),
    getTranslations('landing'),
    getLocale(),
  ])
  const isAr = locale === 'ar'
  const ctaHref = user ? '/watch' : '/auth'

  const { heroVideoUrl, heroVideoType, heroVideoMuted } = config
  const adminYtId =
    heroVideoType === 'youtube' && heroVideoUrl
      ? extractYouTubeId(heroVideoUrl)
      : null
  const ytId = adminYtId ?? (heroVideoType === 'mp4' ? null : FALLBACK_YT_ID)

  return (
    <section className="relative -mt-[calc(var(--nav-h)_+_4rem)] min-h-dvh overflow-hidden">
      {heroVideoType === 'mp4' && heroVideoUrl && (
        <video
          src={heroVideoUrl}
          autoPlay
          muted={heroVideoMuted}
          loop
          playsInline
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}

      {ytId && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=${heroVideoMuted ? 1 : 0}&loop=1&playlist=${ytId}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&disablekb=1&fs=0&cc_load_policy=0`}
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

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 from-5% via-black/25 via-40% to-transparent" />
      <div
        className={`pointer-events-none absolute inset-0 ${
          isAr
            ? 'bg-gradient-to-l from-black/50 via-black/20 to-transparent'
            : 'bg-gradient-to-r from-black/50 via-black/20 to-transparent'
        }`}
      />

      <div className="relative flex min-h-dvh items-end px-4 pt-28 pb-8 sm:px-6 md:px-10 md:pb-10">
        <div className="w-full max-w-[560px]">
          <Image
            src={config.ogImageUrl ?? '/brand/Clickit_final_logo.svg'}
            alt="Clickit Story"
            width={280}
            height={72}
            priority
            unoptimized={!!config.ogImageUrl}
            className="mb-3 h-auto w-48 sm:w-56 md:w-64"
          />
          <p className="mb-5 text-[17px] leading-snug text-[var(--text-dim)]">
            {(isAr ? config.heroDescriptionAr : config.heroDescription) ??
              t('heroDescription')}
          </p>
          <div className="mb-6 md:mb-8">
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
