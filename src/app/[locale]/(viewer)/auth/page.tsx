import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { redirect } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { AuthPanel } from '@/components/auth/auth-panel'
import { getFeaturedShows } from '@/lib/queries'
import { getAppConfig } from '@/lib/config'
import { createClient } from '@/lib/supabase/server'
import { getSafeAuthNextPath } from '@/lib/auth-navigation'
import { cn } from '@/lib/utils'
import type { Locale } from '@/lib/locale'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common')
  return {
    title: `${t('signIn')} | Clickit Story`,
    description: t('tagline'),
  }
}

export default async function AuthPage({
  searchParams,
  params,
}: {
  searchParams?: Promise<{ next?: string }>
  params: Promise<{ locale: string }>
}) {
  const supabase = await createClient()
  const locale = (await params).locale as Locale
  const [shows, config, t, authResult, query] = await Promise.all([
    getFeaturedShows(locale as Locale),
    getAppConfig(),
    getTranslations('auth'),
    supabase.auth.getUser(),
    searchParams,
  ])
  if (authResult.data.user) {
    const { data: configRow } = await supabase
      .from('app_config')
      .select('admin_user_id')
      .eq('id', 1)
      .single()
    const isAdmin = configRow?.admin_user_id === authResult.data.user.id
    redirect({
      href: getSafeAuthNextPath(query?.next, isAdmin ? '/admin' : '/watch'),
      locale,
    })
  }

  const isAr = locale === 'ar'
  // Admin-configured copy wins; fall back to the bundled i18n strings.
  const heading =
    (isAr ? config.authHeadingAr : config.authHeading) ||
    t('welcomeBackHeading')
  const subheading =
    (isAr ? config.authSubheadingAr : config.authSubheading) ||
    t('welcomeBackSubheading')
  const quote = (isAr ? config.authQuoteAr : config.authQuote) || t('quote')
  const quoteAttribution =
    (isAr ? config.authQuoteAttributionAr : config.authQuoteAttribution) ||
    t('quoteAttribution')

  // Admin-uploaded side image wins; otherwise reuse a featured-show backdrop.
  const backdrop =
    config.authImageUrl || shows[1]?.heroImageUrl || shows[0]?.posterUrl

  return (
    <div
      className={cn(
        'relative flex min-h-[calc(100dvh-4rem)] overflow-hidden',
        !config.flags.comingSoonMode && '-mt-16'
      )}
    >
      {/* LEFT — editorial hero. The scrim keeps the quote at 4.5:1+ on any
          admin-uploaded image. */}
      <div className="relative hidden w-1/2 overflow-hidden bg-[var(--bg-1)] lg:block">
        {backdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${backdrop})`,
              animation: 'heroZoom 40s ease-out infinite alternate',
            }}
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(0deg,color-mix(in_srgb,var(--bg-0)_94%,transparent)_0%,color-mix(in_srgb,var(--bg-0)_62%,transparent)_42%,color-mix(in_srgb,var(--bg-0)_8%,transparent)_100%)]"
        />
        <div className="relative flex h-full w-full flex-col justify-end p-12">
          <div className="flex max-w-md flex-col items-start">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-[32px] leading-[1.15] font-normal tracking-[-0.01em] text-[var(--text)]">
              &ldquo;{quote}&rdquo;
            </h2>
            <div className="text-xs tracking-[0.08em] text-[var(--text-dim)] uppercase">
              — {quoteAttribution}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="flex w-full items-center justify-center bg-[var(--bg-0)] px-4 py-8 sm:px-6 md:py-12 lg:w-1/2 lg:py-16">
        <div className="w-full max-w-[420px]">
          <h1 className="mb-2 font-[family-name:var(--font-display)] text-[32px] leading-[1.2] font-semibold tracking-[-0.01em] md:text-[36px]">
            {heading}
          </h1>
          <p className="mb-6 text-[15px] text-[var(--text-dim)] md:mb-8">
            {subheading}
          </p>

          <AuthPanel />

          {/* Skip sign-in — only when the admin has enabled it. Lands on the
              watch catalog; my-list/profile still require an account. */}
          {config.authAllowSkip && (
            <div className="mt-4 text-center md:mt-6">
              <Link
                href="/watch"
                className="inline-flex min-h-11 items-center font-[family-name:var(--font-mono)] text-[13px] tracking-[0.08em] text-[var(--text-mute)] uppercase transition-colors hover:text-[var(--text)]"
              >
                {t('skipSignIn')} →
              </Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes heroZoom {
          from { transform: scale(1); }
          to { transform: scale(1.06); }
        }
      `}</style>
    </div>
  )
}
