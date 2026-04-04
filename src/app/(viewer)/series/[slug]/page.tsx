import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { SeriesDetailHero } from '@/components/series/series-detail-hero'
import { SeriesDetailContent } from '@/components/series/series-detail-content'
import { ContentRail } from '@/components/home/content-rail'
import { CtaBanner } from '@/components/home/cta-banner'
import {
  getShowBySlug,
  getSeasonsByShowId,
  getEpisodesBySeasonId,
  getStreamingShows,
  getShowWatchlistState,
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
  return {
    title: `${show.title} | Clickit Story`,
    description: show.description,
  }
}

export default async function SeriesDetailPage({ params }: Props) {
  const { slug } = await params
  const dbShow = await getShowBySlug(slug)
  if (!dbShow) notFound()

  const show = mapShow(dbShow)
  const seasons = await getSeasonsByShowId(dbShow.id)

  const viewSeasons = seasons.map(mapSeason)

  // Pre-compute all episodes by season
  const viewEpisodesBySeason: Record<string, ViewEpisode[]> = {}
  for (const season of seasons) {
    const eps = await getEpisodesBySeasonId(season.id)
    viewEpisodesBySeason[season.id] = eps.map(mapEpisode)
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

  // User watchlist state
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const inWatchlist = user ? await getShowWatchlistState(user.id, dbShow.id) : false

  // More like this — same genre shows
  const allStreaming = await getStreamingShows()
  const moreLikeThis = allStreaming.filter((s) => s.genre === show.genre && s.id !== show.id)

  return (
    <div>
      <SeriesDetailHero show={show} seasons={viewSeasons} firstEpisodeLabel={firstEpisodeLabel} firstEpisodeId={firstEpisodeId} initialSaved={inWatchlist} userId={user?.id ?? null} />

      <div className="px-6 md:px-12 mt-8">
        <SeriesDetailContent
          seasons={viewSeasons}
          episodesBySeason={viewEpisodesBySeason}
          showBrandColor={show.brandColor}
          show={show}
        />
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
