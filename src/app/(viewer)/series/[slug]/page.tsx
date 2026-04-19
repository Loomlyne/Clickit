import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { SeriesDetailHero } from '@/components/series/series-detail-hero'
import { SeriesDetailContent } from '@/components/series/series-detail-content'
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

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const show = await getShowBySlug(slug)
  if (!show) return { title: 'Show Not Found | Clickit Story' }

  const canonical = `/series/${show.slug}`
  // Prefer the show's own hero image for the OG card (falls back to poster,
  // then the site-wide default via metadataBase). A real show-specific image
  // makes link previews on WhatsApp / Slack / Twitter feel like the show.
  const ogImage = show.hero_url ?? show.poster_url ?? undefined

  return {
    title: `${show.title} | Clickit Story`,
    description: show.description,
    alternates: { canonical },
    openGraph: {
      title: show.title,
      description: show.description,
      url: canonical,
      type: 'video.tv_show',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: show.title,
      description: show.description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

export default async function SeriesDetailPage({ params }: Props) {
  const { slug } = await params
  const dbShow = await getShowBySlug(slug)
  if (!dbShow) notFound()

  const show = mapShow(dbShow)

  // Fetch seasons + all episodes in parallel (2 queries, not N+1)
  const [seasons, allEpisodes] = await Promise.all([
    getSeasonsByShowId(dbShow.id),
    getEpisodesByShowId(dbShow.id),
  ])

  const viewSeasons = seasons.map(mapSeason)

  // Group episodes by season (in-memory, no extra queries)
  const viewEpisodesBySeason: Record<string, ViewEpisode[]> = {}
  for (const season of seasons) {
    viewEpisodesBySeason[season.id] = allEpisodes
      .filter(e => e.season_id === season.id)
      .map(mapEpisode)
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

  return (
    <div>
      <SeriesDetailHero show={show} seasons={viewSeasons} firstEpisodeLabel={firstEpisodeLabel} firstEpisodeId={firstEpisodeId} initialSaved={inWatchlist} initialLiked={isLiked} userId={user?.id ?? null} />

      <div className="mt-8 px-6 md:px-12">
        <div className="mx-auto max-w-7xl">
          {viewSeasons.length === 0 ? (
            <div className="py-16">
              <p className="text-[11px] font-normal uppercase tracking-[0.28em] text-white/38">
                Seasons
              </p>
              <h2 className="font-display mt-2 text-3xl font-semibold text-white">
                Episodes are being prepared.
              </h2>
              <p className="mt-2 text-white/50">Check back soon.</p>
              <Link
                href="/coming-soon"
                className="mt-4 inline-flex items-center text-sm text-white/60 transition-colors hover:text-white"
              >
                See what&apos;s coming &rarr;
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

      {moreLikeThis.length > 0 && (
        <div className="mt-12 pb-16">
          <ContentRail title={`More ${show.genre} Shows`} shows={moreLikeThis} />
        </div>
      )}

      <div className="mt-12 pb-8">
        <CtaBanner />
      </div>
    </div>
  )
}
