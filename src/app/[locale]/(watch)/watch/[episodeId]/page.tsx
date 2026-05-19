import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { WatchShell } from '@/components/watch/watch-shell'
import {
  getEpisodeById,
  getEpisodeProgress,
  getEpisodesProgress,
  mapShow,
  mapEpisode,
  mapSeason,
  getShowWatchlistState,
  getShowLikeState,
} from '@/lib/queries'
import { getLocale } from '@/lib/locale'

interface Props {
  params: Promise<{ episodeId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { episodeId } = await params
  const [data, locale] = await Promise.all([
    getEpisodeById(episodeId),
    getLocale(),
  ])
  if (!data) return { title: 'Episode Not Found | Clickit Story' }

  // Localize titles + descriptions for shareable previews.
  const ep = mapEpisode(data.episode, locale)
  const show = mapShow(data.show, locale)
  const canonical = `/${locale}/watch/${episodeId}`
  const ogImage = data.episode.youtube_video_id
    ? `https://img.youtube.com/vi/${data.episode.youtube_video_id}/maxresdefault.jpg`
    : (data.show.hero_url ?? data.show.poster_url ?? undefined)

  return {
    title: `${ep.title} | ${show.title} | Clickit Story`,
    description: ep.description,
    alternates: { canonical },
    openGraph: {
      title: `${ep.title}, ${show.title}`,
      description: ep.description,
      url: canonical,
      type: 'video.episode',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${ep.title}, ${show.title}`,
      description: ep.description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

export default async function WatchPage({ params }: Props) {
  const { episodeId } = await params

  const supabase = await createClient()
  const [data, locale, authResult] = await Promise.all([
    getEpisodeById(episodeId),
    getLocale(),
    supabase.auth.getUser(),
  ])
  if (!data) notFound()

  const user = authResult.data.user ?? null
  const progressRow = user ? await getEpisodeProgress(user.id, episodeId) : null

  // Second wave, show.id is now available from data
  const episodeIds = Object.values(data.episodesBySeason)
    .flat()
    .map((episode) => episode.id)

  const [inWatchlist, isLiked, progressMap] = user
    ? await Promise.all([
        getShowWatchlistState(user.id, data.show.id),
        getShowLikeState(user.id, data.show.id),
        getEpisodesProgress(user.id, episodeIds),
      ])
    : [false, false, {}]

  const { episode, show, season, seasons, episodesBySeason, prev, next } = data

  const viewEpisode = mapEpisode(episode, locale)
  const viewShow = mapShow(show, locale)
  const viewSeason = mapSeason(season, locale)
  const viewSeasons = seasons.map((s) => mapSeason(s, locale))

  const viewEpisodesBySeason: Record<string, ReturnType<typeof mapEpisode>[]> =
    {}
  for (const [sid, eps] of Object.entries(episodesBySeason)) {
    viewEpisodesBySeason[sid] = eps.map((e) => mapEpisode(e, locale))
  }

  const viewPrev = prev ? mapEpisode(prev, locale) : null
  const viewNext = next ? mapEpisode(next, locale) : null

  const initialProgressSeconds =
    progressRow && !progressRow.completed ? progressRow.progressSeconds : 0

  return (
    <WatchShell
      episode={viewEpisode}
      show={viewShow}
      season={viewSeason}
      seasons={viewSeasons}
      episodesBySeason={viewEpisodesBySeason}
      prevEpisode={viewPrev}
      nextEpisode={viewNext}
      initialProgressSeconds={initialProgressSeconds}
      userId={user?.id ?? null}
      initialSaved={inWatchlist}
      initialLiked={isLiked}
      progressMap={progressMap}
    />
  )
}
