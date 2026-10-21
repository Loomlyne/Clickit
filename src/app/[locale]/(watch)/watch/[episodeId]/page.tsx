import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { isEpisodeLive } from '@/lib/scheduling'
import { WatchShell } from '@/components/watch/watch-shell'
import {
  getEpisodeById,
  getEpisodesProgress,
  getEpisodeYouTubeStatuses,
  mapShow,
  mapEpisode,
  mapSeason,
  getShowWatchlistState,
  getShowLikeState,
} from '@/lib/queries'
import { getLocale } from '@/lib/locale-server'
import { siteUrl } from '@/lib/site-url'
import { JsonLd } from '@/components/seo/json-ld'
import { stripStorageCacheBust } from '@/lib/supabase-media'

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
    : stripStorageCacheBust(
        data.show.hero_url ?? data.show.poster_url ?? undefined
      )

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

  // Scheduling gate: a coming-soon episode whose publish_at hasn't arrived (or a
  // teaser with no date) is not watchable yet. The masking view already strips
  // its youtube id, so the player couldn't load anyway — send the viewer to the
  // show page rather than render an empty player.
  if (!isEpisodeLive(data.episode.status, data.episode.publish_at)) {
    redirect(`/${locale}/series/${data.show.slug}`)
  }

  const user = authResult.data.user ?? null

  // Second wave, show.id is now available from data. Saved positions (with
  // seconds, for resume on every switch) and the stored non-ok YouTube
  // statuses (UAE preflight and precise error reasons) join the same wave.
  // Statuses are read for signed-in and signed-out viewers alike.
  const episodeIds = Object.values(data.episodesBySeason)
    .flat()
    .map((episode) => episode.id)

  const [youtubeStatuses, inWatchlist, isLiked, progressMap] = await Promise.all([
    getEpisodeYouTubeStatuses(episodeIds),
    user ? getShowWatchlistState(user.id, data.show.id) : false,
    user ? getShowLikeState(user.id, data.show.id) : false,
    user ? getEpisodesProgress(user.id, episodeIds) : {},
  ])

  const { episode, show, season, seasons, episodesBySeason } = data

  const viewEpisode = mapEpisode(episode, locale)
  const viewShow = mapShow(show, locale)
  const viewSeason = mapSeason(season, locale)
  const viewSeasons = seasons.map((s) => mapSeason(s, locale))

  const viewEpisodesBySeason: Record<string, ReturnType<typeof mapEpisode>[]> =
    {}
  for (const [sid, eps] of Object.entries(episodesBySeason)) {
    viewEpisodesBySeason[sid] = eps.map((e) => mapEpisode(e, locale))
  }

  // schema.org VideoObject for rich results. YouTube thumb + embed when the
  // episode has a video; localized name/description.
  const videoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: `${viewEpisode.title}, ${viewShow.title}`,
    description: viewEpisode.description || viewShow.description,
    inLanguage: locale === 'ar' ? 'ar' : 'en',
    uploadDate: episode.created_at,
    url: `${siteUrl()}/${locale}/watch/${episodeId}`,
    ...(episode.youtube_video_id
      ? {
          thumbnailUrl: `https://img.youtube.com/vi/${episode.youtube_video_id}/maxresdefault.jpg`,
          embedUrl: `https://www.youtube.com/embed/${episode.youtube_video_id}`,
        }
      : {}),
    partOfSeries: { '@type': 'TVSeries', name: viewShow.title },
  }

  return (
    <>
      <JsonLd data={videoJsonLd} />
      <WatchShell
        episode={viewEpisode}
        show={viewShow}
        season={viewSeason}
        seasons={viewSeasons}
        episodesBySeason={viewEpisodesBySeason}
        userId={user?.id ?? null}
        initialSaved={inWatchlist}
        initialLiked={isLiked}
        progressMap={progressMap}
        youtubeStatuses={youtubeStatuses}
      />
    </>
  )
}
