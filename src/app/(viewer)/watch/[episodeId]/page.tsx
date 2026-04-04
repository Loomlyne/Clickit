import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { WatchPageContent } from '@/components/watch/watch-page-content'
import { getEpisodeById, mapShow } from '@/lib/queries'

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

  // Map to shapes the watch page components expect
  const viewEpisode = {
    id: episode.id,
    showId: episode.show_id,
    seasonId: episode.season_id,
    episodeNumber: episode.episode_number,
    title: episode.title,
    description: episode.description,
    duration: episode.duration,
    status: episode.status,
    youtubeId: episode.youtube_video_id,
  }

  const viewShow = mapShow(show)

  const viewSeason = {
    id: season.id,
    showId: season.show_id,
    seasonNumber: season.season_number,
    title: season.title,
    episodeCount: season.episode_count,
  }

  const viewSeasons = seasons.map((s) => ({
    id: s.id,
    showId: s.show_id,
    seasonNumber: s.season_number,
    title: s.title,
    episodeCount: s.episode_count,
  }))

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
      status: e.status,
      youtubeId: e.youtube_video_id,
    }))
  }

  const viewPrev = prev ? { id: prev.id, title: prev.title, episodeNumber: prev.episode_number } : null
  const viewNext = next ? { id: next.id, title: next.title, episodeNumber: next.episode_number } : null

  return (
    <WatchPageContent
      episode={viewEpisode as any}
      show={viewShow as any}
      season={viewSeason as any}
      seasons={viewSeasons as any}
      episodesBySeason={viewEpisodesBySeason}
      prevEpisode={viewPrev as any}
      nextEpisode={viewNext as any}
    />
  )
}
