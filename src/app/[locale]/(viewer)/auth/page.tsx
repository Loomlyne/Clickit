import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { redirect } from '@/i18n/navigation'
import { AuthSignInForm } from '@/components/auth/auth-sign-in-form'
import { getFeaturedShows } from '@/lib/queries'
import { getAppConfig } from '@/lib/config'
import { authInitialMode, getSafeAuthNextPath } from '@/lib/auth-navigation'
import { cn } from '@/lib/utils'
import type { Locale } from '@/lib/locale'
import { getAdminStatus } from '@/server/auth-guards'
import { ADMIN_DESTINATION, DEFAULT_DESTINATION } from '@/server/auth/sign-in-core'

// Static title only: /auth is the same plain sign-in page for every next (D-03).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common')
  return {
    title: `${t('signIn')} | Clickit Story`,
    description: t('tagline'),
  }
}

function firstString(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * Unified sign-in (UI-SPEC 5.1, 6.1; D-02..D-05). No show data here (D-03,
 * T-05-22-01): the validated same-origin next is the only thing that carries
 * the viewer back to the show or episode she came from. No skip-sign-in link
 * (D-02).
 */
export default async function AuthPage({
  searchParams,
  params,
}: {
  searchParams?: Promise<{ next?: string | string[]; mode?: string | string[] }>
  params: Promise<{ locale: string }>
}) {
  const locale = (await params).locale as Locale
  const [shows, config, t, status, query] = await Promise.all([
    getFeaturedShows(locale),
    getAppConfig(),
    getTranslations('auth'),
    getAdminStatus(),
    searchParams,
  ])

  const rawNext = firstString(query?.next)
  if (status.signedIn) {
    // Admins come from public.admins via getAdminStatus (never app_config).
    redirect({
      href: getSafeAuthNextPath(
        rawNext,
        status.isAdmin ? ADMIN_DESTINATION : DEFAULT_DESTINATION
      ),
      locale,
    })
  }

  // '' = no next: the server action then picks /admin or /browse itself.
  const safeNext = getSafeAuthNextPath(rawNext, '')

  const isAr = locale === 'ar'
  // The quote stays in the hero pane only; the admin-configured auth heading
  // is no longer read here (UI-SPEC 5.1, item 12).
  const quote = (isAr ? config.authQuoteAr : config.authQuote) || t('quote')
  const quoteAttribution =
    (isAr ? config.authQuoteAttributionAr : config.authQuoteAttribution) ||
    t('quoteAttribution')

  // Admin-uploaded side image wins; otherwise the default featured-show art.
  const backdrop =
    config.authImageUrl || shows[1]?.heroImageUrl || shows[0]?.posterUrl

  return (
    <div
      className={cn(
        'relative flex min-h-[calc(100dvh-4rem)] overflow-hidden',
        !config.flags.comingSoonMode && '-mt-16'
      )}
    >
      {/* Hero pane. The scrim keeps the quote at 4.5:1+ on any admin-uploaded image. */}
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
            <p className="mb-4 font-[family-name:var(--font-display)] text-[32px] leading-[1.15] font-normal tracking-[-0.01em] text-[var(--text)]">
              &ldquo;{quote}&rdquo;
            </p>
            <div className="text-xs tracking-[0.08em] text-[var(--text-dim)] uppercase">
              — {quoteAttribution}
            </div>
          </div>
        </div>
      </div>

      {/* Form column */}
      <div className="flex w-full items-center justify-center bg-[var(--bg-0)] px-4 py-8 sm:px-6 md:py-12 lg:w-1/2 lg:py-16">
        <div className="w-full max-w-[420px]">
          <AuthSignInForm
            next={safeNext}
            locale={locale}
            initialMode={authInitialMode(firstString(query?.mode))}
          />
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
