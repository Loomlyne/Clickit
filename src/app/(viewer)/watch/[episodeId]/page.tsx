import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { WatchPageContent } from '@/components/watch/watch-page-content'
import { getEpisodeById, mapShow, mapEpisode, mapSeason } from '@/lib/queries'

interface Props {
  params: Promise<{ episodeId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { episodeId } = await params
  const data = await getEpisodeById(episodeId)
  if (!data) return { title: 'Episode Not Found | Clickit Story' }
  return {
    title: `${data.episode.title} | ${data.show.title} | Clickit Story`,
    description: data.episode.description,
  }
}

export default async function WatchPage({ params }: Props) {
  const { episodeId } = await params
  const data = await getEpisodeById(episodeId)

  if (!data) notFound()

  const { episode, show, season, seasons, episodesBySeason, prev, next } = data

  const viewEpisode = mapEpisode(episode)
  const viewShow = mapShow(show)
  const viewSeason = mapSeason(season)
  const viewSeasons = seasons.map(mapSeason)

  const viewEpisodesBySeason: Record<string, ReturnType<typeof mapEpisode>[]> = {}
  for (const [sid, eps] of Object.entries(episodesBySeason)) {
    viewEpisodesBySeason[sid] = eps.map(mapEpisode)
  }

  const viewPrev = prev ? mapEpisode(prev) : null
  const viewNext = next ? mapEpisode(next) : null

  return (
    <WatchPageContent
      episode={viewEpisode}
      show={viewShow}
      season={viewSeason}
      seasons={viewSeasons}
      episodesBySeason={viewEpisodesBySeason}
      prevEpisode={viewPrev}
      nextEpisode={viewNext}
    />
  )
}
