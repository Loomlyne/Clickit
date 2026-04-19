import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { WatchPageContent } from '@/components/watch/watch-page-content'
import { getEpisodeById, getEpisodeProgress, mapShow, mapEpisode, mapSeason } from '@/lib/queries'
import { isEditorial } from '@/lib/design'
import { EditorialWatch } from '@/components/editorial/watch'
import { adaptShow, adaptEpisode } from '@/lib/editorial/adapter'

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

  if (isEditorial) {
    // Collect all episodes (flattened across seasons) for the editorial layout
    const allEpisodes = Object.values(viewEpisodesBySeason).flat()
    const editorialShow = adaptShow(viewShow, {
      episodes: allEpisodes,
      progressMap: user && initialProgressSeconds > 0 && viewEpisode.duration
        ? { [viewEpisode.id]: initialProgressSeconds / viewEpisode.duration }
        : {},
    })
    const editorialEpisode = adaptEpisode(viewEpisode, 0)
    const editorialUpNext = viewNext ? adaptEpisode(viewNext, 0) : null

    // For the editorial variant we embed a simple YouTube iframe as playerSlot.
    // Progress tracking via the full IFrame API can be re-integrated in a
    // follow-up by swapping WatchPageContent into the slot. This first pass
    // prioritises the aesthetic A/B comparison.
    const youtubeId = viewEpisode.youtubeId
    const start = Math.floor(initialProgressSeconds)
    const playerSlot = youtubeId ? (
      <iframe
        src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1${start > 0 ? `&start=${start}` : ''}&rel=0`}
        title={viewEpisode.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 0 }}
      />
    ) : (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text-dim)',
        }}
      >
        No video source for this episode.
      </div>
    )

    return (
      <EditorialWatch
        show={editorialShow}
        episode={editorialEpisode}
        upNext={editorialUpNext}
        playerSlot={playerSlot}
      />
    )
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
