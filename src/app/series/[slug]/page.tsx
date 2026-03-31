import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SeriesDetailHero } from '@/components/series/series-detail-hero'
import { SeriesDetailContent } from '@/components/series/series-detail-content'
import { ContentRail } from '@/components/home/content-rail'
import {
  type Episode,
  MOCK_SHOWS,
  getShowBySlug,
  getSeasonsByShowId,
  getEpisodesBySeasonId,
} from '@/lib/mock-data'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const show = getShowBySlug(slug)
  if (!show) return { title: 'Show Not Found | Clickit Story' }
  return {
    title: `${show.title} | Clickit Story`,
    description: show.description,
  }
}

export function generateStaticParams() {
  return MOCK_SHOWS.map((show) => ({ slug: show.slug }))
}

export default async function SeriesDetailPage({ params }: Props) {
  const { slug } = await params
  const show = getShowBySlug(slug)
  if (!show) notFound()

  const seasons = getSeasonsByShowId(show.id)

  // Pre-compute all episodes by season on the server (serializable prop)
  const episodesBySeason: Record<string, Episode[]> = {}
  for (const season of seasons) {
    episodesBySeason[season.id] = getEpisodesBySeasonId(season.id)
  }

  // Compute first episode label and ID for hero CTA
  let firstEpisodeLabel: string | undefined
  let firstEpisodeId: string | undefined
  if (seasons.length > 0) {
    const firstSeason = seasons[0]
    const firstSeasonEpisodes = episodesBySeason[firstSeason.id] ?? []
    const firstPublished = firstSeasonEpisodes.find(
      (ep) => ep.status === 'published'
    )
    if (firstPublished) {
      firstEpisodeLabel = `S${firstSeason.seasonNumber} E${firstPublished.episodeNumber}`
      firstEpisodeId = firstPublished.id
    }
  }

  // Compute "More Like This" — same genre, excluding current show
  const moreLikeThis = MOCK_SHOWS.filter(
    (s) => s.genre === show.genre && s.id !== show.id
  )

  return (
    <div>
      <SeriesDetailHero show={show} firstEpisodeLabel={firstEpisodeLabel} firstEpisodeId={firstEpisodeId} />

      <div className="px-6 md:px-12 mt-8">
        <SeriesDetailContent
          seasons={seasons}
          episodesBySeason={episodesBySeason}
          showBrandColor={show.brandColor}
        />
      </div>

      {moreLikeThis.length > 0 && (
        <div className="mt-12 pb-16">
          <ContentRail title={`More ${show.genre} Shows`} shows={moreLikeThis} />
        </div>
      )}
    </div>
  )
}
