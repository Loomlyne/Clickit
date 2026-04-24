import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

import { createClient } from '@/lib/supabase/server'
import { SeriesDetailHero } from '@/components/series/series-detail-hero'
import { SeriesDetailContent } from '@/components/series/series-detail-content'
import { ReviewComposer } from '@/components/series/review-composer'
import { ContentRail } from '@/components/home/content-rail'
import { CtaBanner } from '@/components/home/cta-banner'
import {
  getShowBySlug,
  getSeasonsByShowId,
  getEpisodesByShowId,
  getStreamingShows,
  getShowWatchlistState,
  getShowLikeState,
  getEpisodesProgress,
  mapShow,
  mapSeason,
  mapEpisode,
  type ViewEpisode,
} from '@/lib/queries'
import { getLocale } from '@/lib/locale'

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
  const [dbShow, locale] = await Promise.all([getShowBySlug(slug), getLocale()])
  if (!dbShow) notFound()

  const show = mapShow(dbShow, locale)

  // Fetch seasons + all episodes in parallel (2 queries, not N+1)
  const [seasons, allEpisodes] = await Promise.all([
    getSeasonsByShowId(dbShow.id),
    getEpisodesByShowId(dbShow.id),
  ])

  const viewSeasons = seasons.map((s) => mapSeason(s, locale))

  // Group episodes by season (in-memory, no extra queries)
  const viewEpisodesBySeason: Record<string, ViewEpisode[]> = {}
  for (const season of seasons) {
    viewEpisodesBySeason[season.id] = allEpisodes
      .filter(e => e.season_id === season.id)
      .map((e) => mapEpisode(e, locale))
  }

  // First episode for hero CTA
  let firstEpisodeLabel: string | undefined
  let firstEpisodeId: string | undefined
  if (viewSeasons.length > 0) {
    const firstSeason = viewSeasons[0]
    const firstSeasonEpisodes = viewEpisodesBySeason[firstSeason.id] ?? []
    const firstPublished = firstSeasonEpisodes.find((ep) => ep.status === 'published')
    if (firstPublished) {
      firstEpisodeLabel = `S${firstSeason.seasonNumber} E${firstPublished.episodeNumber}`
      firstEpisodeId = firstPublished.id
    }
  }

  // User watchlist state + episode progress
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [inWatchlist, isLiked] = user
    ? await Promise.all([
        getShowWatchlistState(user.id, dbShow.id),
        getShowLikeState(user.id, dbShow.id),
      ])
    : [false, false]

  // Batch-fetch episode progress for logged-in user
  let episodesProgressMap: Record<string, { progressPercent: number; completed: boolean }> = {}
  if (user) {
    const allEpisodeIds = Object.values(viewEpisodesBySeason).flat().map(e => e.id)
    episodesProgressMap = await getEpisodesProgress(user.id, allEpisodeIds)
  }

  // More like this — same genre shows
  const allStreaming = await getStreamingShows()
  const moreLikeThis = allStreaming.filter((s) => s.genre === show.genre && s.id !== show.id)

  const t = await getTranslations('show')

  return (
    <div>
      <SeriesDetailHero show={show} seasons={viewSeasons} firstEpisodeLabel={firstEpisodeLabel} firstEpisodeId={firstEpisodeId} initialSaved={inWatchlist} initialLiked={isLiked} userId={user?.id ?? null} />

      <div className="mt-8 px-6 md:px-12">
        <div className="mx-auto max-w-7xl">
          {viewSeasons.length === 0 ? (
            <div className="py-16">
              <p className="text-[11px] font-normal uppercase tracking-[0.28em] text-white/38">
                {t('seasonsLabel')}
              </p>
              <h2 className="font-display mt-2 text-3xl font-semibold text-white">
                {t('emptyEpisodesHeading')}
              </h2>
              <p className="mt-2 text-white/50">{t('emptyEpisodesDescription')}</p>
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

      {moreLikeThis.length > 0 && (
        <div className="mt-12 pb-16">
          <ContentRail title={t('moreLikeThisHeading', { genre: show.genre })} shows={moreLikeThis} />
        </div>
      )}

      <div className="mt-12 pb-8">
        <CtaBanner />
      </div>
    </div>
  )
}
