import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { redirect } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { AuthPanel } from '@/components/auth/auth-panel'
import { BotIdInit } from '@/components/auth/botid-init'
import { getFeaturedShows } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import { getSafeAuthNextPath } from '@/lib/auth-navigation'

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
  const [shows, t, authResult, query, routeParams] = await Promise.all([
    getFeaturedShows(),
    getTranslations('auth'),
    supabase.auth.getUser(),
    searchParams,
    params,
  ])
  if (authResult.data.user) {
    redirect({
      href: getSafeAuthNextPath(query?.next, '/watch'),
      locale: routeParams.locale,
    })
  }

  const backdrop = shows[1]?.heroImageUrl || shows[0]?.posterUrl

  return (
    <div className="relative -mt-16 flex min-h-[calc(100dvh-4rem)] overflow-hidden">
      <BotIdInit />

      {/* LEFT — editorial hero */}
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        {backdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${backdrop})`,
              animation: 'heroZoom 40s ease-out infinite alternate',
            }}
          />
        )}
        <div className="absolute inset-0 bg-black/18" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/46 to-black/72" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/26 to-transparent" />

        <div className="relative flex h-full w-full flex-col justify-between p-12">
          {/* Middle: quote */}
          <div className="flex h-full max-w-md flex-col items-start justify-end">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-[32px] leading-[1.15] font-normal tracking-[-0.01em] text-white">
              &ldquo;{t('quote')}&rdquo;
            </h2>
            <div className="mono text-[11px] text-white/40">
              — {t('quoteAttribution')}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="flex w-full items-center justify-center bg-[var(--bg-0)] px-5 py-8 sm:px-6 md:py-12 lg:w-1/2 lg:py-16">
        <div className="w-full max-w-[420px]">
          <h1 className="mb-2 font-[family-name:var(--font-display)] text-[32px] font-normal tracking-[-0.01em] md:text-[36px]">
            {t('welcomeBackHeading')}
          </h1>
          <p className="mb-6 text-[15px] text-[var(--text-dim)] md:mb-8">
            {t('welcomeBackSubheading')}
          </p>

          <AuthPanel />

          <div className="mt-4 text-center md:mt-6">
            <Link
              href="/watch"
              className="inline-flex min-h-11 items-center font-[family-name:var(--font-mono)] text-[13px] tracking-[0.08em] text-[var(--text-mute)] uppercase transition-colors hover:text-[var(--text)]"
            >
              {t('skipSignIn')} →
            </Link>
          </div>
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
