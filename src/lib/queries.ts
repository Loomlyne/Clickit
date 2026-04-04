import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

export type DbShow = Database['public']['Tables']['shows']['Row']
export type DbSeason = Database['public']['Tables']['seasons']['Row']
export type DbEpisode = Database['public']['Tables']['episodes']['Row']

// Map DB show to the shape viewer components expect
export type ViewShow = {
  id: string
  title: string
  slug: string
  tagline: string
  description: string
  genre: string
  episodeCount: number
  seasonCount: number
  status: 'streaming' | 'coming-soon'
  brandColor: 'brand-blue' | 'brand-purple' | 'brand-green' | 'brand-red' | 'brand-orange'
  posterUrl?: string
  heroImageUrl?: string
  imdbRating?: number
  platformRating?: number
}

export function mapShow(db: DbShow): ViewShow {
  return {
    id: db.id,
    title: db.title,
    slug: db.slug,
    tagline: db.tagline ?? '',
    description: db.description,
    genre: db.genre,
    episodeCount: db.episode_count,
    seasonCount: db.season_count,
    status: db.status === 'now-streaming' ? 'streaming' : 'coming-soon',
    brandColor: (db.brand_color || 'brand-blue') as ViewShow['brandColor'],
    posterUrl: db.poster_url ?? undefined,
    heroImageUrl: db.hero_url ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// View types: Episode and Season
// ---------------------------------------------------------------------------

export type ViewEpisode = {
  id: string
  showId: string
  seasonId: string
  episodeNumber: number
  title: string
  description: string
  duration: number | null
  status: 'published' | 'coming-soon' | 'draft'
  youtubeId: string | null
  publishedAt?: string
}

export type ViewSeason = {
  id: string
  showId: string
  seasonNumber: number
  title: string
  episodeCount: number
}

export function mapEpisode(db: DbEpisode): ViewEpisode {
  return {
    id: db.id,
    showId: db.show_id,
    seasonId: db.season_id,
    episodeNumber: db.episode_number,
    title: db.title,
    description: db.description,
    duration: db.duration,
    status: db.status as ViewEpisode['status'],
    youtubeId: db.youtube_video_id,
    publishedAt: db.created_at,
  }
}

export type ContinueWatchingItem = {
  episodeId: string
  episodeTitle: string
  episodeNumber: number
  seasonNumber: number
  showId: string
  showTitle: string
  showSlug: string
  showBrandColor: ViewShow['brandColor']
  youtubeVideoId: string | null
  progressSeconds: number
  durationSeconds: number
  progressPercent: number
}

export function mapSeason(db: DbSeason): ViewSeason {
  return {
    id: db.id,
    showId: db.show_id,
    seasonNumber: db.season_number,
    title: db.title,
    episodeCount: db.episode_count,
  }
}

// ---------------------------------------------------------------------------
// Homepage queries
// ---------------------------------------------------------------------------

export async function getFeaturedShows(): Promise<ViewShow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shows')
    .select('*')
    .eq('featured', true)
    .eq('archived', false)
    .limit(5)

  if (!data || data.length === 0) {
    // Fallback: first 3 streaming shows if none featured
    const { data: fallback } = await supabase
      .from('shows')
      .select('*')
      .eq('status', 'now-streaming')
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(3)
    return (fallback ?? []).map(mapShow)
  }

  return data.map(mapShow)
}

export async function getStreamingShows(): Promise<ViewShow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shows')
    .select('*')
    .eq('status', 'now-streaming')
    .eq('archived', false)
    .order('created_at', { ascending: false })

  return (data ?? []).map(mapShow)
}

export async function getComingSoonShows(): Promise<ViewShow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shows')
    .select('*')
    .eq('status', 'coming-soon')
    .eq('archived', false)
    .order('created_at', { ascending: false })

  return (data ?? []).map(mapShow)
}

export async function getNewEpisodeShows(): Promise<ViewShow[]> {
  const supabase = await createClient()
  // Get recently published episodes and map back to unique shows
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: episodes } = await supabase
    .from('episodes')
    .select('show_id')
    .eq('status', 'published')
    .eq('archived', false)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  if (!episodes || episodes.length === 0) return []

  // Get unique show IDs
  const showIds = [...new Set(episodes.map((e) => e.show_id))]

  const { data: shows } = await supabase
    .from('shows')
    .select('*')
    .in('id', showIds)
    .eq('archived', false)

  return (shows ?? []).map(mapShow)
}

// ---------------------------------------------------------------------------
// Series detail queries
// ---------------------------------------------------------------------------

export async function getShowBySlug(slug: string): Promise<DbShow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shows')
    .select('*')
    .eq('slug', slug)
    .eq('archived', false)
    .single()

  return data
}

export async function getSeasonsByShowId(showId: string): Promise<DbSeason[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('seasons')
    .select('*')
    .eq('show_id', showId)
    .order('season_number', { ascending: true })

  return data ?? []
}

export async function getEpisodesBySeasonId(seasonId: string): Promise<DbEpisode[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('episodes')
    .select('*')
    .eq('season_id', seasonId)
    .eq('archived', false)
    .in('status', ['published', 'coming-soon'])
    .order('episode_number', { ascending: true })

  return data ?? []
}

// ---------------------------------------------------------------------------
// Watch page queries
// ---------------------------------------------------------------------------

export async function getEpisodeById(episodeId: string) {
  const supabase = await createClient()

  const { data: episode } = await supabase
    .from('episodes')
    .select('*')
    .eq('id', episodeId)
    .single()

  if (!episode) return null

  const { data: season } = await supabase
    .from('seasons')
    .select('*')
    .eq('id', episode.season_id)
    .single()

  const { data: show } = await supabase
    .from('shows')
    .select('*')
    .eq('id', episode.show_id)
    .single()

  if (!season || !show) return null

  const seasons = await getSeasonsByShowId(show.id)

  // Get all episodes grouped by season for navigation
  const episodesBySeason: Record<string, DbEpisode[]> = {}
  for (const s of seasons) {
    episodesBySeason[s.id] = await getEpisodesBySeasonId(s.id)
  }

  // Flatten all published episodes across all seasons for cross-season navigation
  const allEpisodes: DbEpisode[] = []
  for (const s of seasons) {
    const eps = episodesBySeason[s.id] ?? []
    allEpisodes.push(...eps.filter(e => e.status === 'published'))
  }

  // Sort by (season_number, episode_number)
  const seasonNumberMap = new Map(seasons.map(s => [s.id, s.season_number]))
  allEpisodes.sort((a, b) => {
    const aSeason = seasonNumberMap.get(a.season_id) ?? 0
    const bSeason = seasonNumberMap.get(b.season_id) ?? 0
    if (aSeason !== bSeason) return aSeason - bSeason
    return a.episode_number - b.episode_number
  })

  const currentIdx = allEpisodes.findIndex(e => e.id === episodeId)
  const prev = currentIdx > 0 ? allEpisodes[currentIdx - 1] : null
  const next = currentIdx < allEpisodes.length - 1 ? allEpisodes[currentIdx + 1] : null

  return { episode, show, season, seasons, episodesBySeason, prev, next }
}

// ---------------------------------------------------------------------------
// Episode progress query
// ---------------------------------------------------------------------------

export async function getEpisodeProgress(
  userId: string,
  episodeId: string
): Promise<{ progressSeconds: number; durationSeconds: number; completed: boolean } | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('watch_progress')
    .select('progress_seconds, duration_seconds, completed')
    .eq('user_id', userId)
    .eq('episode_id', episodeId)
    .maybeSingle()

  if (!data) return null
  return {
    progressSeconds: data.progress_seconds,
    durationSeconds: data.duration_seconds ?? 0,
    completed: data.completed,
  }
}

// ---------------------------------------------------------------------------
// Continue watching
// ---------------------------------------------------------------------------

export async function getContinueWatchingEpisodes(
  userId: string
): Promise<ContinueWatchingItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('watch_progress')
    .select('progress_seconds, duration_seconds, episode_id, episodes!inner(id, title, episode_number, youtube_video_id, show_id, season_id, seasons!inner(season_number), shows!inner(id, title, slug, brand_color))')
    .eq('user_id', userId)
    .eq('completed', false)
    .gt('progress_seconds', 0)
    .order('updated_at', { ascending: false })
    .limit(10)

  if (!data) return []

  return data.map((row: any) => {
    const ep = row.episodes
    const dur = row.duration_seconds || 1
    return {
      episodeId: ep.id,
      episodeTitle: ep.title,
      episodeNumber: ep.episode_number,
      seasonNumber: ep.seasons.season_number,
      showId: ep.shows.id,
      showTitle: ep.shows.title,
      showSlug: ep.shows.slug,
      showBrandColor: (ep.shows.brand_color || 'brand-blue') as ViewShow['brandColor'],
      youtubeVideoId: ep.youtube_video_id ?? null,
      progressSeconds: row.progress_seconds,
      durationSeconds: dur,
      progressPercent: Math.min(Math.round((row.progress_seconds / dur) * 100), 99),
    }
  })
}

// ---------------------------------------------------------------------------
// Genre query
// ---------------------------------------------------------------------------

export async function getDistinctGenres(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shows')
    .select('genre')
    .eq('archived', false)
    .in('status', ['now-streaming', 'coming-soon'])

  if (!data) return []
  return [...new Set(data.map((row) => row.genre))].sort()
}

// ---------------------------------------------------------------------------
// Schedule query
// ---------------------------------------------------------------------------

export async function getScheduleShows(): Promise<
  (ViewShow & { broadcastDay: string | null; broadcastTime: string | null })[]
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shows')
    .select('*')
    .eq('archived', false)
    .eq('status', 'now-streaming')
    .not('broadcast_day', 'is', null)
    .order('broadcast_day')

  return (data ?? []).map((s) => ({
    ...mapShow(s),
    broadcastDay: s.broadcast_day,
    broadcastTime: s.broadcast_time,
  }))
}

// ---------------------------------------------------------------------------
// Coming soon episodes query
// ---------------------------------------------------------------------------

export async function getComingSoonEpisodes(): Promise<
  (ViewEpisode & { showTitle: string; showSlug: string; showBrandColor: ViewShow['brandColor'] })[]
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('episodes')
    .select('*, shows!inner(title, slug, brand_color, status)')
    .eq('status', 'coming-soon')
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []).map((e: any) => ({
    ...mapEpisode(e),
    showTitle: e.shows.title,
    showSlug: e.shows.slug,
    showBrandColor: e.shows.brand_color as ViewShow['brandColor'],
  }))
}

// ---------------------------------------------------------------------------
// All shows query (for /series listing)
// ---------------------------------------------------------------------------

export async function getAllShows(): Promise<ViewShow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shows')
    .select('*')
    .eq('archived', false)
    .in('status', ['now-streaming', 'coming-soon'])
    .order('title')

  return (data ?? []).map(mapShow)
}

// ---------------------------------------------------------------------------
// Search queries (Postgres FTS)
// ---------------------------------------------------------------------------

export async function searchShows(query: string): Promise<ViewShow[]> {
  if (!query || query.trim().length < 2) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('shows')
    .select('*')
    .eq('archived', false)
    .in('status', ['now-streaming', 'coming-soon'])
    .textSearch('fts', query, { type: 'websearch', config: 'english' })
    .limit(20)

  return (data ?? []).map(mapShow)
}

export async function searchEpisodes(
  query: string
): Promise<
  (ViewEpisode & { showTitle: string; showSlug: string; showBrandColor: ViewShow['brandColor'] })[]
> {
  if (!query || query.trim().length < 2) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('episodes')
    .select('*, shows!inner(title, slug, brand_color, status)')
    .eq('archived', false)
    .eq('status', 'published')
    .textSearch('fts', query, { type: 'websearch', config: 'english' })
    .limit(30)

  return (data ?? []).map((e: any) => ({
    ...mapEpisode(e),
    showTitle: e.shows.title,
    showSlug: e.shows.slug,
    showBrandColor: e.shows.brand_color as ViewShow['brandColor'],
  }))
}

// ---------------------------------------------------------------------------
// Watchlist queries
// ---------------------------------------------------------------------------

export async function getWatchlistShows(userId: string): Promise<ViewShow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('watchlist')
    .select('show_id, created_at, shows(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (!data) return []
  return data
    .map((row: any) => row.shows)
    .filter(Boolean)
    .map(mapShow)
}

// ---------------------------------------------------------------------------
// Recently watched + batch episode progress
// ---------------------------------------------------------------------------

export type RecentlyWatchedItem = {
  episodeId: string
  episodeTitle: string
  episodeNumber: number
  seasonNumber: number
  showTitle: string
  showSlug: string
  showBrandColor: ViewShow['brandColor']
  progressSeconds: number
  durationSeconds: number
  completed: boolean
  updatedAt: string
}

export async function getRecentlyWatched(userId: string): Promise<RecentlyWatchedItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('watch_progress')
    .select('progress_seconds, duration_seconds, completed, updated_at, episode_id, episodes!inner(id, title, episode_number, season_id, show_id, seasons!inner(season_number), shows!inner(title, slug, brand_color))')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(10)

  if (!data) return []

  return data.map((row: any) => {
    const ep = row.episodes
    return {
      episodeId: ep.id,
      episodeTitle: ep.title,
      episodeNumber: ep.episode_number,
      seasonNumber: ep.seasons.season_number,
      showTitle: ep.shows.title,
      showSlug: ep.shows.slug,
      showBrandColor: (ep.shows.brand_color || 'brand-blue') as ViewShow['brandColor'],
      progressSeconds: row.progress_seconds,
      durationSeconds: row.duration_seconds ?? 0,
      completed: row.completed,
      updatedAt: row.updated_at,
    }
  })
}

export async function getEpisodesProgress(
  userId: string,
  episodeIds: string[]
): Promise<Record<string, { progressPercent: number; completed: boolean }>> {
  if (episodeIds.length === 0) return {}
  const supabase = await createClient()
  const { data } = await supabase
    .from('watch_progress')
    .select('episode_id, progress_seconds, duration_seconds, completed')
    .eq('user_id', userId)
    .in('episode_id', episodeIds)

  if (!data) return {}

  const result: Record<string, { progressPercent: number; completed: boolean }> = {}
  for (const row of data) {
    const dur = row.duration_seconds || 1
    result[row.episode_id] = {
      progressPercent: Math.min(Math.round((row.progress_seconds / dur) * 100), 100),
      completed: row.completed,
    }
  }
  return result
}

export async function getShowWatchlistState(userId: string, showId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('watchlist')
    .select('show_id')
    .eq('user_id', userId)
    .eq('show_id', showId)
    .maybeSingle()

  return !!data
}

export async function getShowsWatchlistState(userId: string, showIds: string[]): Promise<Set<string>> {
  if (showIds.length === 0) return new Set()
  const supabase = await createClient()
  const { data } = await supabase
    .from('watchlist')
    .select('show_id')
    .eq('user_id', userId)
    .in('show_id', showIds)

  return new Set((data ?? []).map((row) => row.show_id))
}
