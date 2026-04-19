// Adapter — maps the app's real Supabase-backed ViewShow/ViewEpisode shapes
// into the shape the editorial prototype components expect.
//
// The prototype was written against its own SHOWS fixture with fields like
// `episodes: 8`, `rating: "TV-14"`, `runtime: "34 min"`, `backdrop: url`,
// `episodeList: [...]`. Rather than rewrite every component to read real DB
// names, we produce a thin shape-compatible object at the page boundary.
//
// Keep this file pure — no Supabase calls, just mapping. Pages fetch with
// existing queries (src/lib/queries.ts) and call these adapters.

import type { ViewShow, ViewEpisode, ViewSeason } from '@/lib/queries'

export type EditorialShow = {
  id: string
  slug: string
  title: string
  genre: string
  year: number
  rating: string
  episodes: number
  runtime: string
  synopsis: string
  tagline: string
  creator: string
  poster: string
  backdrop: string
  landscape: string
  progress: number
  new: boolean
  featured: boolean
  comingSoon: boolean
  episodeList: EditorialEpisode[]
  cast?: Array<{ name: string; role: string; photo: string }>
}

export type EditorialEpisode = {
  id: string
  num: number
  title: string
  description: string
  runtime: string
  thumb: string
  progress: number
  youtubeId: string | null
}

const PLACEHOLDER_ART = 'https://picsum.photos/seed/clickit/800/450'

export function adaptShow(
  show: ViewShow,
  opts: {
    episodes?: ViewEpisode[]
    progressMap?: Record<string, number> // episodeId -> progress 0..1
    createdAt?: string
  } = {},
): EditorialShow {
  const episodes = opts.episodes ?? []
  const progressMap = opts.progressMap ?? {}

  const poster = show.posterUrl ?? PLACEHOLDER_ART
  const backdrop = show.heroImageUrl ?? show.heroVideoUrl ?? PLACEHOLDER_ART

  // "new" = created within last 21 days, if createdAt supplied
  const isNew = opts.createdAt
    ? Date.now() - new Date(opts.createdAt).getTime() < 21 * 24 * 60 * 60 * 1000
    : false

  const comingSoon = show.status === 'coming-soon'

  // Aggregate show progress = max of episode progresses (or 0)
  const showProgress = Math.max(
    0,
    ...Object.values(progressMap),
  )

  // Runtime display: average episode duration in minutes
  const avgDuration =
    episodes.length > 0
      ? episodes.reduce((a, e) => a + (e.duration ?? 0), 0) / episodes.length
      : 0
  const runtime = avgDuration > 0 ? `${Math.round(avgDuration / 60)} min` : '30 min'

  return {
    id: show.id,
    slug: show.slug,
    title: show.title,
    genre: show.genre,
    year: new Date().getFullYear(),
    rating: 'TV-14',
    episodes: show.episodeCount,
    runtime,
    synopsis: show.description,
    tagline: show.tagline || show.description.slice(0, 60),
    creator: 'Clickit Originals',
    poster,
    backdrop,
    landscape: backdrop,
    progress: showProgress,
    new: isNew,
    featured: false, // set by caller (featured showcase uses getFeaturedShows())
    comingSoon,
    episodeList: episodes.map((ep) => ({
      id: ep.id,
      num: ep.episodeNumber,
      title: ep.title,
      description: ep.description,
      runtime: ep.duration ? `${Math.round(ep.duration / 60)} min` : '—',
      thumb: ep.youtubeId
        ? `https://img.youtube.com/vi/${ep.youtubeId}/hqdefault.jpg`
        : poster,
      progress: progressMap[ep.id] ?? 0,
      youtubeId: ep.youtubeId,
    })),
  }
}

export function adaptEpisode(ep: ViewEpisode, progress = 0): EditorialEpisode {
  return {
    id: ep.id,
    num: ep.episodeNumber,
    title: ep.title,
    description: ep.description,
    runtime: ep.duration ? `${Math.round(ep.duration / 60)} min` : '—',
    thumb: ep.youtubeId
      ? `https://img.youtube.com/vi/${ep.youtubeId}/hqdefault.jpg`
      : PLACEHOLDER_ART,
    progress,
    youtubeId: ep.youtubeId,
  }
}

export type { ViewSeason }
