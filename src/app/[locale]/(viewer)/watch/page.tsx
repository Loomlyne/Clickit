import { Suspense } from 'react'

import { getLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { HeroBanner } from '@/components/home/hero-banner'
import { FeaturedHeroWithWatched } from '@/components/home/featured-hero-with-watched'
import { ContentRail } from '@/components/home/content-rail'
import { ContinueWatchingRail } from '@/components/home/continue-watching-rail'
import { ShortsRail } from '@/components/browse/shorts-rail'
import { createClient } from '@/lib/supabase/server'
import {
  getFeaturedShows,
  getStreamingShows,
  getComingSoonShows,
  getCategoryRails,
  getCategoryRailBySlug,
  getFirstEpisodesForShows,
  getShortsForBrowse,
} from '@/lib/queries'
import { getIsMobile } from '@/lib/device'
import type { Locale } from '@/lib/locale'

export default async function WatchPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const categorySlug = params?.category?.trim() || null
  const locale = (await getLocale()) as Locale

  const [
    {
      data: { user },
    },
    featured,
  ] = await Promise.all([supabase.auth.getUser(), getFeaturedShows(locale)])
  const userId = user?.id ?? null

  // Stage 2: everything else in parallel, including first-episode map which
  // now runs alongside the heavy catalog queries instead of after them
  const [
    streaming,
    comingSoon,
    shorts,
    isMobile,
    categoryRails,
    activeCategory,
    firstEpisodeMap,
    t,
  ] = await Promise.all([
    getStreamingShows(locale),
    getComingSoonShows(locale),
    getShortsForBrowse(),
    getIsMobile(),
    getCategoryRails(locale),
    categorySlug
      ? getCategoryRailBySlug(categorySlug, locale)
      : Promise.resolve(null),
    getFirstEpisodesForShows(featured.map((s) => s.id)),
    getTranslations('watch'),
  ])

  if (streaming.length === 0 && comingSoon.length === 0) {
    redirect({ href: '/portfolio', locale })
  }

  const railsToRender = categorySlug
    ? activeCategory
      ? [activeCategory]
      : []
    : categoryRails

  const featuredFallbackShows = featured.map((show) => ({
    show,
    firstEpisodeId: firstEpisodeMap[show.id],
    hasWatched: false,
  }))

  return (
    <div>
      {featured.length > 0 && (
        <div className="-mt-16">
          {userId ? (
            <Suspense
              fallback={
                <HeroBanner shows={featuredFallbackShows} isMobile={isMobile} />
              }
            >
              <FeaturedHeroWithWatched
                userId={userId}
                featured={featured}
                firstEpisodeMap={firstEpisodeMap}
                isMobile={isMobile}
              />
            </Suspense>
          ) : (
            <HeroBanner shows={featuredFallbackShows} isMobile={isMobile} />
          )}
        </div>
      )}

      <Suspense fallback={null}>
        <ContinueWatchingRail userId={userId} />
      </Suspense>

      <ShortsRail shorts={shorts} />

      {streaming.length > 0 && (
        <ContentRail
          sectionId="now-streaming"
          title={t('railPrograms')}
          shows={streaming}
          seeAllHref="/watch"
          minCards={0}
        />
      )}
      {comingSoon.length > 0 && (
        <ContentRail
          sectionId="coming-soon"
          title={t('railComingSoon')}
          shows={comingSoon}
        />
      )}

      {activeCategory && (
        <section className="px-4 pt-6 sm:px-10">
          <div className="flex flex-col gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg-1)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {activeCategory.color && (
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: activeCategory.color }}
                />
              )}
              <h2 className="font-display text-[24px]">
                {locale === 'ar'
                  ? activeCategory.nameAr
                  : activeCategory.nameEn}
              </h2>
            </div>
            <Link
              href="/watch"
              className="mono inline-flex min-h-11 items-center text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
            >
              {t('clearFilter')}
            </Link>
          </div>
        </section>
      )}

      {railsToRender.map((category) => (
        <ContentRail
          key={category.id}
          title={
            { ar: category.nameAr, en: category.nameEn }[locale] ??
            category.nameEn
          }
          shows={category.shows}
          seeAllHref={`/watch?category=${encodeURIComponent(category.slug)}`}
        />
      ))}

      {categorySlug && !activeCategory && (
        <section className="px-4 pt-8 sm:px-10">
          <div className="rounded-[12px] border border-[var(--line)] bg-[var(--bg-2)] px-5 py-6 text-center">
            <div className="mono mb-2 text-[var(--text-mute)]">
              {t('categoryNotFound')}
            </div>
            <Link
              href="/watch"
              className="inline-flex min-h-11 items-center justify-center text-sm text-[var(--accent)]"
            >
              {t('backToWatch')}
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
