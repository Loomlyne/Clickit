import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

import { createClient } from '@/lib/supabase/server'
import { SeriesDetailHero } from '@/components/series/series-detail-hero'
import { SeriesDetailContent } from '@/components/series/series-detail-content'
import { ReviewComposer } from '@/components/series/review-composer'
import { ContentRail } from '@/components/home/content-rail'
import {
  getShowBySlug,
  getSeasonsByShowId,
  getEpisodesByShowId,
  getShowsByGenre,
  getOtherStreamingShows,
  getShowWatchlistState,
  getShowLikeState,
  getEpisodesProgress,
  mapShow,
  mapSeason,
  mapEpisode,
  type ViewEpisode,
} from '@/lib/queries'
import { getLocale } from '@/lib/locale'
import { getIsMobile } from '@/lib/device'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [show, locale] = await Promise.all([getShowBySlug(slug), getLocale()])
  if (!show) return { title: 'Show Not Found | Clickit Story' }

  // Localized title/description on the OG card so Arabic-cookie users sharing a
  // link still see Arabic copy in the WhatsApp/Slack preview.
  const view = mapShow(show, locale)
  const canonical = `/series/${show.slug}`
  const ogImage = show.hero_url ?? show.poster_url ?? undefined

  return {
    title: `${view.title} | Clickit Story`,
    description: view.description,
    alternates: { canonical },
    openGraph: {
      title: view.title,
      description: view.description,
      url: canonical,
      type: 'video.tv_show',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: view.title,
      description: view.description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

export default async function SeriesDetailPage({ params }: Props) {
  const { slug } = await params
  const [dbShow, locale, isMobile] = await Promise.all([
    getShowBySlug(slug),
    getLocale(),
    getIsMobile(),
  ])
  if (!dbShow) notFound()

  const show = mapShow(dbShow, locale)

  const supabase = await createClient()
  const [
    seasons,
    allEpisodes,
    { data: castMembers },
    {
      data: { user },
    },
    moreLikeThis,
    t,
  ] = await Promise.all([
    getSeasonsByShowId(dbShow.id),
    getEpisodesByShowId(dbShow.id),
    supabase
      .from('show_cast')
      .select('*')
      .eq('show_id', dbShow.id)
      .order('sort_order'),
    supabase.auth.getUser(),
    getShowsByGenre(dbShow.genre, dbShow.id, locale),
    getTranslations('show'),
  ])

  const viewSeasons = seasons.map((s) => mapSeason(s, locale))

  // Group episodes by season (in-memory, no extra queries)
  const viewEpisodesBySeason: Record<string, ViewEpisode[]> = {}
  for (const season of seasons) {
    viewEpisodesBySeason[season.id] = allEpisodes
      .filter((e) => e.season_id === season.id)
      .map((e) => mapEpisode(e, locale))
  }

  // First episode for hero CTA
  let firstEpisodeLabel: string | undefined
  let firstEpisodeId: string | undefined
  if (viewSeasons.length > 0) {
    const firstSeason = viewSeasons[0]
    const firstSeasonEpisodes = viewEpisodesBySeason[firstSeason.id] ?? []
    const firstPublished = firstSeasonEpisodes.find(
      (ep) => ep.status === 'published'
    )
    if (firstPublished) {
      firstEpisodeLabel = t('seasonEpisodeShort', {
        season: firstSeason.seasonNumber,
        episode: firstPublished.episodeNumber,
      })
      firstEpisodeId = firstPublished.id
    }
  }

  // User-specific data: watchlist, liked, and episode progress all in one parallel wave.
  // allEpisodeIds is in-memory (no query) so it's safe to compute here.
  const allEpisodeIds = Object.values(viewEpisodesBySeason)
    .flat()
    .map((e) => e.id)
  const [inWatchlist, isLiked, episodesProgressMap] = user
    ? await Promise.all([
        getShowWatchlistState(user.id, dbShow.id),
        getShowLikeState(user.id, dbShow.id),
        getEpisodesProgress(user.id, allEpisodeIds),
      ])
    : [
        false,
        false,
        {} as Record<string, { progressPercent: number; completed: boolean }>,
      ]

  // "More Like This" rail: prefer same-genre shows; if this show is the only
  // one in its genre, fall back to other streaming shows so the rail still
  // appears (under a generic heading instead of "More {genre} shows").
  const hasGenreMatches = moreLikeThis.length > 0
  const relatedShows = hasGenreMatches
    ? moreLikeThis
    : await getOtherStreamingShows(dbShow.id, locale)
  const relatedHeading = hasGenreMatches
    ? t('moreLikeThisHeading', { genre: show.genre })
    : t('moreShowsHeading')

  return (
    <div className="-mt-16">
      <SeriesDetailHero
        show={show}
        seasons={viewSeasons}
        firstEpisodeLabel={firstEpisodeLabel}
        firstEpisodeId={firstEpisodeId}
        initialSaved={inWatchlist}
        initialLiked={isLiked}
        userId={user?.id ?? null}
        isMobile={isMobile}
      />

      {/* Cast */}
      {castMembers && castMembers.length > 0 && (
        <div className="mt-12 px-6 md:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="label mb-4">{t('cast')}</div>
            <div className="scrollbar-hide flex gap-5 overflow-x-auto pb-3">
              {castMembers.map((c) => (
                <div
                  key={c.id}
                  className="shrink-0 text-center"
                  style={{ width: 100 }}
                >
                  {c.image_url ? (
                    <Image
                      src={c.image_url}
                      alt={c.name}
                      width={80}
                      height={80}
                      unoptimized
                      className="mx-auto mb-2 h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--bg-3)] text-lg font-medium text-[var(--text-dim)]">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="truncate text-[13px] font-medium">
                    {c.name}
                  </div>
                  {c.role && (
                    <div className="mono truncate text-[10px] text-[var(--text-mute)]">
                      {c.role}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 px-6 md:px-12">
        <div className="mx-auto max-w-7xl">
          {viewSeasons.length === 0 ? (
            <div className="py-16">
              <p className="text-[11px] font-normal tracking-[0.28em] text-white/38 uppercase">
                {t('seasonsLabel')}
              </p>
              <h2 className="font-display mt-2 text-3xl font-semibold text-white">
                {t('emptyEpisodesHeading')}
              </h2>
              <p className="mt-2 text-white/50">
                {t('emptyEpisodesDescription')}
              </p>
              <Link
                href="/coming-soon"
                className="mt-4 inline-flex items-center text-sm text-white/60 transition-colors hover:text-white"
              >
                {t('comingSoonEyebrow')} &rarr;
              </Link>
            </div>
          ) : (
            <SeriesDetailContent
              seasons={viewSeasons}
              episodesBySeason={viewEpisodesBySeason}
              showBrandColor={show.brandColor}
              show={show}
              progressMap={episodesProgressMap}
            />
          )}
        </div>
      </div>

      {/* Reviews */}
      <div className="mt-12 px-6 md:px-12">
        <div className="mx-auto max-w-7xl">
          <ReviewComposer showId={dbShow.id} userId={user?.id ?? null} />
        </div>
      </div>

      {relatedShows.length > 0 && (
        <div className="mt-12 pb-16">
          <ContentRail title={relatedHeading} shows={relatedShows} />
        </div>
      )}
    </div>
  )
}
