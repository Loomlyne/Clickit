// Browse page — matches handoff browse.jsx exactly
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { HeroBanner } from '@/components/home/hero-banner'
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

export default async function BrowsePage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>
}) {
  // proxy.ts already validated the JWT this request — getSession() reads the
  // refreshed cookie locally without a Supabase auth round-trip (~5ms vs
  // ~50-150ms for getUser()). Same pattern viewer-layout.tsx uses.
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id ?? null
  const params = await searchParams
  const categorySlug = params?.category?.trim() || null

  // Stage 1: featured alone — fast cached query, needed for stage 2 IDs
  const featured = await getFeaturedShows()

  // Stage 2: everything else in parallel, including first-episode map which
  // now runs alongside the heavy catalog queries instead of after them
  const [
    streaming,
    comingSoon,
    shorts,
    isMobile,
    locale,
    categoryRails,
    activeCategory,
    firstEpisodeMap,
  ] = await Promise.all([
    getStreamingShows(),
    getComingSoonShows(),
    getShortsForBrowse(),
    getIsMobile(),
    getLocale(),
    getCategoryRails(),
    categorySlug ? getCategoryRailBySlug(categorySlug) : Promise.resolve(null),
    getFirstEpisodesForShows(featured.map((s) => s.id)),
  ])

  if (streaming.length === 0 && comingSoon.length === 0) {
    redirect({ href: '/', locale })
  }

  const railsToRender = categorySlug
    ? activeCategory
      ? [activeCategory]
      : []
    : categoryRails

  const featuredWithEpisodes = featured.map((show) => ({
    show,
    firstEpisodeId: firstEpisodeMap[show.id],
  }))

  return (
    <div>
      {featuredWithEpisodes.length > 0 && (
        <div className="-mt-16">
          <HeroBanner shows={featuredWithEpisodes} isMobile={isMobile} />
        </div>
      )}

      <ContinueWatchingRail userId={userId} />

      <ShortsRail shorts={shorts} />

      {streaming.length > 0 && (
        <ContentRail
          title="Now streaming"
          shows={streaming}
          seeAllHref="/browse"
        />
      )}
      {comingSoon.length > 0 && (
        <ContentRail
          title="Coming soon"
          eyebrow="Teasers & release dates"
          shows={comingSoon}
          seeAllHref="/coming-soon"
        />
      )}

      {activeCategory && (
        <section className="px-10 pt-6">
          <div
            className="flex flex-col gap-3 rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
            style={
              activeCategory.color
                ? {
                    borderLeftColor: activeCategory.color,
                    borderLeftWidth: '3px',
                  }
                : undefined
            }
          >
            <div>
              <div
                className="mono mb-1.5"
                style={
                  activeCategory.color
                    ? { color: activeCategory.color }
                    : undefined
                }
              >
                {locale === 'ar' ? 'التصنيف النشط' : 'Active category'}
              </div>
              <h2 className="font-display text-[24px]">
                {locale === 'ar'
                  ? activeCategory.nameAr
                  : activeCategory.nameEn}
              </h2>
            </div>
            <Link
              href="/browse"
              className="mono inline-flex min-h-11 items-center text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
            >
              {locale === 'ar' ? 'مسح الفلتر' : 'Clear filter'}
            </Link>
          </div>
        </section>
      )}

      {railsToRender.map((category) => (
        <ContentRail
          key={category.id}
          title={locale === 'ar' ? category.nameAr : category.nameEn}
          eyebrow={
            category.icon ||
            (locale === 'ar' ? 'مختارات حسب التصنيف' : 'Curated category picks')
          }
          accentColor={category.color ?? undefined}
          shows={category.shows}
          seeAllHref={`/browse?category=${encodeURIComponent(category.slug)}`}
        />
      ))}

      {categorySlug && !activeCategory && (
        <section className="px-10 pt-8">
          <div className="rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-5 py-6 text-center">
            <div className="mono mb-2 text-[var(--text-mute)]">
              {locale === 'ar' ? 'التصنيف غير موجود' : 'Category not found'}
            </div>
            <Link
              href="/browse"
              className="inline-flex min-h-11 items-center justify-center text-sm text-[var(--accent)]"
            >
              {locale === 'ar' ? 'العودة إلى التصفح' : 'Back to browse'}
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
