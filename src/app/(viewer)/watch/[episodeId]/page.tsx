import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { WatchPageContent } from '@/components/watch/watch-page-content'
import { getEpisodeById, getEpisodeProgress, mapShow, mapEpisode, mapSeason } from '@/lib/queries'

interface Props {
  params: Promise<{ episodeId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { episodeId } = await params
  const data = await getEpisodeById(episodeId)
  if (!data) return { title: 'Episode Not Found | Clickit Story' }

  const canonical = `/watch/${episodeId}`
  // YouTube thumbnails are always available for published episodes; fall back
  // to the show's hero/poster image if the episode has no YouTube ID yet.
  const ogImage = data.episode.youtube_video_id
    ? `https://img.youtube.com/vi/${data.episode.youtube_video_id}/maxresdefault.jpg`
    : data.show.hero_url ?? data.show.poster_url ?? undefined

  return {
    title: `${data.episode.title} | ${data.show.title} | Clickit Story`,
    description: data.episode.description,
    alternates: { canonical },
    openGraph: {
      title: `${data.episode.title} — ${data.show.title}`,
      description: data.episode.description,
      url: canonical,
      type: 'video.episode',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${data.episode.title} — ${data.show.title}`,
      description: data.episode.description,
      images: ogImage ? [ogImage] : undefined,
    },
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

  // Fetch user and saved progress for resume
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let initialProgressSeconds = 0
  if (user) {
    const progress = await getEpisodeProgress(user.id, episodeId)
    if (progress && !progress.completed) {
      initialProgressSeconds = progress.progressSeconds
    }
  }

  return (
    <WatchPageContent
      episode={viewEpisode}
      show={viewShow}
      season={viewSeason}
      seasons={viewSeasons}
      episodesBySeason={viewEpisodesBySeason}
      prevEpisode={viewPrev}
      nextEpisode={viewNext}
      initialProgressSeconds={initialProgressSeconds}
      userId={user?.id ?? null}
    />
  )
}
