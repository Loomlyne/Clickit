import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SeriesDetailHero } from '@/components/series/series-detail-hero'
import { SeriesDetailContent } from '@/components/series/series-detail-content'
import { ContentRail } from '@/components/home/content-rail'
import { CtaBanner } from '@/components/home/cta-banner'
import {
  getShowBySlug,
  getSeasonsByShowId,
  getEpisodesBySeasonId,
  getStreamingShows,
  mapShow,
  type DbEpisode,
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

  // Map seasons to the shape components expect
  const viewSeasons = seasons.map((s) => ({
    id: s.id,
    showId: s.show_id,
    seasonNumber: s.season_number,
    title: s.title,
    episodeCount: s.episode_count,
  }))

  // Pre-compute all episodes by season
  const episodesBySeason: Record<string, DbEpisode[]> = {}
  for (const season of seasons) {
    episodesBySeason[season.id] = await getEpisodesBySeasonId(season.id)
  }

  // Map episodes to the shape components expect
  const viewEpisodesBySeason: Record<string, any[]> = {}
  for (const [seasonId, eps] of Object.entries(episodesBySeason)) {
    viewEpisodesBySeason[seasonId] = eps.map((e) => ({
      id: e.id,
      showId: e.show_id,
      seasonId: e.season_id,
      episodeNumber: e.episode_number,
      title: e.title,
      description: e.description,
      duration: e.duration,
      status: e.status === 'published' ? 'published' : e.status,
      youtubeId: e.youtube_video_id,
      publishedAt: e.created_at,
    }))
  }

  // First episode for hero CTA
  let firstEpisodeLabel: string | undefined
  let firstEpisodeId: string | undefined
  if (viewSeasons.length > 0) {
    const firstSeason = viewSeasons[0]
    const firstSeasonEpisodes = viewEpisodesBySeason[firstSeason.id] ?? []
    const firstPublished = firstSeasonEpisodes.find((ep: any) => ep.status === 'published')
    if (firstPublished) {
      firstEpisodeLabel = `S${firstSeason.seasonNumber} E${firstPublished.episodeNumber}`
      firstEpisodeId = firstPublished.id
    }
  }

  // More like this — same genre shows
  const allStreaming = await getStreamingShows()
  const moreLikeThis = allStreaming.filter((s) => s.genre === show.genre && s.id !== show.id)

  return (
    <div>
      <SeriesDetailHero show={show} seasons={viewSeasons} firstEpisodeLabel={firstEpisodeLabel} firstEpisodeId={firstEpisodeId} />

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
