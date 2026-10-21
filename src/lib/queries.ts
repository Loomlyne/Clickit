import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/public'
import { createAdminClient } from '@/lib/supabase/admin'
import { toYouTubeStatusMap, type StoredNonOkStatus } from '@/lib/watch/status-map'
import type { Database } from '@/lib/database.types'
import { DEFAULT_LOCALE, localizedField, pickLocalized, type Locale } from '@/lib/locale'
import { isEpisodeLive } from '@/lib/scheduling'
import {
  resolveSupabaseVideoUrl,
  stripStorageCacheBust,
} from '@/lib/supabase-media'

export type DbShow = Database['public']['Tables']['shows']['Row']
export type DbSeason = Database['public']['Tables']['seasons']['Row']
export type DbEpisode = Database['public']['Tables']['episodes']['Row']
export type DbCategory = Database['public']['Tables']['categories']['Row']

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
  cardImageUrl?: string
  heroImageUrl?: string
  heroImageMobileUrl?: string
  heroVideoUrl?: string
  heroVideoType?: 'mp4' | 'youtube'
  heroVideoMobileUrl?: string
  heroVideoMobileType?: 'mp4' | 'youtube'
  imdbRating?: number
  platformRating?: number
}

export type ViewCategory = {
  id: string
  nameEn: string
  nameAr: string
  slug: string
  icon: string | null
  color: string | null
  sortOrder: number
}

export type CategoryRail = ViewCategory & {
  shows: ViewShow[]
}

export function mapShow(db: DbShow, locale: Locale = DEFAULT_LOCALE): ViewShow {
  return {
    id: db.id,
    // Locale-aware: when the user's NEXT_LOCALE cookie is 'ar' AND the row has
    // a non-empty title_ar/description_ar/tagline_ar, return the Arabic value.
    // English is always the safe fallback. Genre stays English-only — it's an
    // internal taxonomy, not user-facing copy.
    title: pickLocalized(locale, db.title, db.title_ar),
    slug: db.slug,
    tagline: pickLocalized(locale, db.tagline ?? '', db.tagline_ar),
    description: pickLocalized(locale, db.description, db.description_ar),
    genre: db.genre,
    episodeCount: db.episode_count,
    seasonCount: db.season_count,
    // DB has three statuses (draft, coming-soon, now-streaming); viewer-facing
    // ViewShow has two. Queries should already filter drafts out upstream, but
    // if one ever leaks through we conservatively present it as coming-soon.
    status: db.status === 'now-streaming' ? 'streaming' : 'coming-soon',
    brandColor: (db.brand_color || 'brand-blue') as ViewShow['brandColor'],
    posterUrl: stripStorageCacheBust(db.poster_url ?? undefined),
    cardImageUrl: stripStorageCacheBust(db.card_image_url ?? undefined),
    heroImageUrl: stripStorageCacheBust(db.hero_url ?? undefined),
    heroImageMobileUrl: stripStorageCacheBust(db.hero_image_mobile_url ?? undefined),
    heroVideoUrl: db.hero_video_url
      ? resolveSupabaseVideoUrl(db.hero_video_url) ?? undefined
      : undefined,
    heroVideoType: (db.hero_video_type as ViewShow['heroVideoType']) ?? undefined,
    heroVideoMobileUrl: db.hero_video_mobile_url
      ? resolveSupabaseVideoUrl(db.hero_video_mobile_url) ?? undefined
      : undefined,
    heroVideoMobileType: (db.hero_video_mobile_type as ViewShow['heroVideoMobileType']) ?? undefined,
  }
}

export async function mapShowLocalized(
  db: DbShow,
  locale: Locale = DEFAULT_LOCALE
): Promise<ViewShow> {
  if (locale === 'en') return mapShow(db, locale)

  const [title, tagline, description] = await Promise.all([
    localizedField(locale, db.title, db.title_ar),
    localizedField(locale, db.tagline ?? '', db.tagline_ar),
    localizedField(locale, db.description, db.description_ar),
  ])

  return { ...mapShow(db, locale), title, tagline, description }
}

export async function mapShowsLocalized(
  dbs: DbShow[],
  locale: Locale = DEFAULT_LOCALE
): Promise<ViewShow[]> {
  return Promise.all(dbs.map((db) => mapShowLocalized(db, locale)))
}

export async function mapEpisodeLocalized(
  db: DbEpisode,
  locale: Locale = DEFAULT_LOCALE
): Promise<ViewEpisode> {
  if (locale === 'en') return mapEpisode(db, locale)

  const [title, description] = await Promise.all([
    localizedField(locale, db.title, db.title_ar),
    localizedField(locale, db.description, db.description_ar),
  ])

  return { ...mapEpisode(db, locale), title, description }
}

export function mapCategory(db: DbCategory): ViewCategory {
  return {
    id: db.id,
    nameEn: db.name_en,
    nameAr: db.name_ar,
    slug: db.slug,
    icon: db.icon,
    color: db.color ?? null,
    sortOrder: db.sort_order,
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
  // Scheduled publish time (UTC ISO) for coming-soon episodes, null otherwise.
  publishAt: string | null
  // True when a viewer can watch right now: published, OR coming-soon whose
  // publish_at has passed. Computed at read time so the episode flips on at the
  // exact scheduled minute. See lib/scheduling.isEpisodeLive.
  isLive: boolean
}

export type ViewSeason = {
  id: string
  showId: string
  seasonNumber: number
  title: string
  episodeCount: number
}

export function mapEpisode(db: DbEpisode, locale: Locale = DEFAULT_LOCALE): ViewEpisode {
  return {
    id: db.id,
    showId: db.show_id,
    seasonId: db.season_id,
    episodeNumber: db.episode_number,
    title: pickLocalized(locale, db.title, db.title_ar),
    description: pickLocalized(locale, db.description, db.description_ar),
    duration: db.duration,
    status: db.status as ViewEpisode['status'],
    youtubeId: db.youtube_video_id,
    publishedAt: db.created_at,
    publishAt: db.publish_at ?? null,
    isLive: isEpisodeLive(db.status, db.publish_at),
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

export function mapSeason(db: DbSeason, locale: Locale = DEFAULT_LOCALE): ViewSeason {
  return {
    id: db.id,
    showId: db.show_id,
    seasonNumber: db.season_number,
    title: pickLocalized(locale, db.title, db.title_ar),
    episodeCount: db.episode_count,
  }
}

// ---------------------------------------------------------------------------
// Site config queries
// ---------------------------------------------------------------------------

export type HeroVideo = {
  url: string
  type: 'mp4' | 'youtube'
}

export const getHeroVideo = unstable_cache(
  async (): Promise<HeroVideo | null> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('app_config')
      .select('hero_video_url, hero_video_type')
      .eq('id', 1)
      .single()

    if (!data?.hero_video_url || !data?.hero_video_type) return null
    return { url: data.hero_video_url, type: data.hero_video_type as HeroVideo['type'] }
  },
  ['hero-video'],
  { revalidate: 900, tags: ['site-config'] } // 15 min
)

// ---------------------------------------------------------------------------
// Homepage queries
// ---------------------------------------------------------------------------

// React cache() wraps unstable_cache to dedupe repeat calls within ONE request.
// Landing page renders LandingHero, ShowsPortfolio, and CtaBanner — all three
// call getFeaturedShows(). Without cache(), each one does its own Vercel
// data-cache lookup. With cache(), only the first lookup runs; the rest are
// in-memory hits.
export const getFeaturedShows = cache(unstable_cache(
  async (locale: Locale = DEFAULT_LOCALE): Promise<ViewShow[]> => {
    const supabase = createPublicClient()
    // No limit: every featured show the admin selects cycles in the hero
    // carousel — whether that's 1 or 50.
    const { data } = await supabase
      .from('shows')
      .select('*')
      .eq('featured', true)
      .eq('archived', false)
      .order('updated_at', { ascending: false })

    if (!data || data.length === 0) {
      // Fallback: first 3 streaming shows if none featured
      const { data: fallback } = await supabase
        .from('shows')
        .select('*')
        .eq('status', 'now-streaming')
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(3)
      return mapShowsLocalized(fallback ?? [], locale)
    }

    return mapShowsLocalized(data, locale)
  },
  ['featured-shows'],
  { revalidate: 900, tags: ['shows'] } // 15 min — featured list changes occasionally
))

export const getStreamingShows = unstable_cache(
  async (locale: Locale = DEFAULT_LOCALE): Promise<ViewShow[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('shows')
      .select('*')
      .eq('status', 'now-streaming')
      .eq('archived', false)
      .order('created_at', { ascending: false })

    return mapShowsLocalized(data ?? [], locale)
  },
  ['streaming-shows'],
  { revalidate: 3600, tags: ['shows'] } // 1 hr — show status rarely changes
)

// "More Like This" rail. Filters by genre at the DB level (instead of fetching
// every streaming show and filtering in memory) and excludes the current show.
// Locale-aware: maps titles/descriptions for the requested locale so the rail
// is not English-only for Arabic users. genre is the English-only taxonomy.
export const getShowsByGenre = unstable_cache(
  async (
    genre: string,
    excludeId: string,
    locale: Locale = DEFAULT_LOCALE
  ): Promise<ViewShow[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('shows')
      .select('*')
      .eq('status', 'now-streaming')
      .eq('archived', false)
      .eq('genre', genre)
      .neq('id', excludeId)
      .order('created_at', { ascending: false })

    return mapShowsLocalized(data ?? [], locale)
  },
  ['shows-by-genre'],
  { revalidate: 3600, tags: ['shows'] } // 1 hr — matches getStreamingShows
)

// Fallback for the "More Like This" rail when a show is the only one in its
// genre (e.g. the lone Culture show): show other streaming shows so the rail
// is never empty. Locale-aware, excludes the current show.
export const getOtherStreamingShows = unstable_cache(
  async (
    excludeId: string,
    locale: Locale = DEFAULT_LOCALE,
    limit = 12
  ): Promise<ViewShow[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('shows')
      .select('*')
      .eq('status', 'now-streaming')
      .eq('archived', false)
      .neq('id', excludeId)
      .order('created_at', { ascending: false })
      .limit(limit)

    return mapShowsLocalized(data ?? [], locale)
  },
  ['other-streaming-shows'],
  { revalidate: 3600, tags: ['shows'] }
)

export const getComingSoonShows = unstable_cache(
  async (locale: Locale = DEFAULT_LOCALE): Promise<ViewShow[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('shows')
      .select('*')
      .eq('status', 'coming-soon')
      .eq('archived', false)
      .order('created_at', { ascending: false })

    return mapShowsLocalized(data ?? [], locale)
  },
  ['coming-soon-shows'],
  { revalidate: 3600, tags: ['shows'] } // 1 hr
)

// Lightweight feed for sitemap.xml. Returns every crawlable show + published
// episode with its real last-updated timestamp so crawlers (Google + AI bots)
// get accurate <lastmod> and re-crawl only what changed. Generated from the
// DB, so new shows/episodes appear automatically — no code change needed.
export type SitemapEntry = { path: string; lastmod: string }
export const getSitemapEntries = unstable_cache(
  async (): Promise<{ shows: SitemapEntry[]; episodes: SitemapEntry[] }> => {
    const supabase = createPublicClient()
    const [showsRes, episodesRes] = await Promise.all([
      supabase
        .from('shows')
        .select('slug, updated_at')
        .eq('archived', false)
        .in('status', ['now-streaming', 'coming-soon']),
      // Published episodes whose parent show is live. shows!inner enforces the
      // join filter so episodes under archived shows are excluded.
      supabase
        .from('episodes')
        .select('id, updated_at, shows!inner(archived, status)')
        .eq('status', 'published')
        .eq('archived', false)
        .eq('shows.archived', false),
    ])

    return {
      shows: (showsRes.data ?? []).map((s) => ({
        path: `/series/${s.slug}`,
        lastmod: s.updated_at,
      })),
      episodes: (episodesRes.data ?? []).map((e) => ({
        path: `/watch/${e.id}`,
        lastmod: e.updated_at,
      })),
    }
  },
  ['sitemap-entries'],
  { revalidate: 3600, tags: ['shows'] }
)

export const getCategories = unstable_cache(
  async (): Promise<ViewCategory[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    return (data ?? []).map(mapCategory)
  },
  ['categories'],
  { revalidate: 3600, tags: ['categories'] }
)

export const getCategoryRails = unstable_cache(
  async (locale: Locale = DEFAULT_LOCALE): Promise<CategoryRail[]> => {
    const supabase = createPublicClient()
    const [categories, assignments] = await Promise.all([
      getCategories(),
      supabase
        .from('show_categories')
        .select('category_id, shows!inner(*)')
        .eq('shows.archived', false)
        .in('shows.status', ['now-streaming', 'coming-soon']),
    ])

    const showsByCategory = new Map<string, Array<DbShow>>()
    for (const row of ((assignments.data ?? []) as unknown as Array<{ category_id: string; shows: DbShow | DbShow[] | null }>)) {
      const show = Array.isArray(row.shows) ? row.shows[0] : row.shows
      if (!show) continue
      const existing = showsByCategory.get(row.category_id) ?? []
      existing.push(show)
      showsByCategory.set(row.category_id, existing)
    }

    const rails = await Promise.all(
      categories.map(async (category) => {
        const shows = (showsByCategory.get(category.id) ?? [])
          .sort((a, b) => b.created_at.localeCompare(a.created_at))

        return {
          ...category,
          shows: await mapShowsLocalized(shows, locale),
        }
      })
    )

    return rails.filter((category) => category.shows.length > 0)
  },
  ['category-rails'],
  { revalidate: 3600, tags: ['categories', 'shows'] }
)

export const getCategoryRailBySlug = unstable_cache(
  async (slug: string, locale: Locale = DEFAULT_LOCALE): Promise<CategoryRail | null> => {
    const rails = await getCategoryRails(locale)
    return rails.find((rail) => rail.slug === slug) ?? null
  },
  ['category-rail-by-slug'],
  { revalidate: 3600, tags: ['categories', 'shows'] }
)

export type NewEpisodeItem = ViewEpisode & {
  showTitle: string
  showSlug: string
  showBrandColor: ViewShow['brandColor']
  showPosterUrl?: string
}

export const getNewEpisodes = unstable_cache(
  async (): Promise<NewEpisodeItem[]> => {
    const supabase = createPublicClient()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data } = await supabase
      .from('episodes_view')
      .select(
        'id, show_id, season_id, episode_number, title, title_ar, description, description_ar, duration, status, publish_at, archived, created_at, updated_at, youtube_video_id, show_title, show_slug, show_brand_color, show_poster_url'
      )
      .eq('status', 'published')
      .eq('archived', false)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20)

    type NewEpisodeRow = DbEpisode & {
      show_title?: string | null
      show_slug?: string | null
      show_brand_color?: string | null
      show_poster_url?: string | null
    }
    return ((data ?? []) as unknown as NewEpisodeRow[]).map((e) => ({
      ...mapEpisode(e),
      showTitle: e.show_title ?? '',
      showSlug: e.show_slug ?? '',
      showBrandColor: (e.show_brand_color || 'brand-blue') as ViewShow['brandColor'],
      showPosterUrl: stripStorageCacheBust(e.show_poster_url ?? undefined),
    }))
  },
  ['new-episodes'],
  { revalidate: 900, tags: ['episodes'] } // 15 min — new episodes added regularly
)

// ---------------------------------------------------------------------------
// Batch queries — eliminate N+1 on browse + series pages
// ---------------------------------------------------------------------------

/**
 * For each show, returns the first published episode of season 1.
 * One query instead of 2N (seasons + episodes per show).
 */
// unstable_cache includes the function's arguments in the cache key by default.
// Bumping the keyParts to '-v2' forces a one-time cache flush after the other
// changes in this commit land — safer than assuming the old entries will
// revalidate naturally within the 30-minute window.
export const getFirstEpisodesForShows = unstable_cache(
  async (showIds: string[]): Promise<Record<string, string>> => {
    if (showIds.length === 0) return {}
    const supabase = createPublicClient()

    // Join episodes → seasons, filter season_number=1, episode_number=1, published
    const { data } = await supabase
      .from('episodes')
      .select('id, show_id, seasons!inner(season_number)')
      .in('show_id', showIds)
      .eq('archived', false)
      .eq('status', 'published')
      .eq('seasons.season_number', 1)
      .eq('episode_number', 1)

    const result: Record<string, string> = {}
    for (const row of data ?? []) {
      result[row.show_id] = row.id
    }
    return result
  },
  ['first-episodes-for-shows-v2'],
  { revalidate: 1800, tags: ['episodes'] } // 30 min
)

/**
 * Fetch ALL episodes for a show across all seasons in one query.
 * Caller groups by season_id as needed.
 */
export const getEpisodesByShowId = unstable_cache(
  async (showId: string): Promise<DbEpisode[]> => {
    const supabase = createPublicClient()
    // Read the masking view: coming-soon teasers are included, but their
    // youtube_video_id is null until the episode is effectively live.
    const { data } = await supabase
      .from('episodes_view')
      .select('*')
      .eq('show_id', showId)
      .order('episode_number', { ascending: true })

    return (data ?? []) as unknown as DbEpisode[]
  },
  ['episodes-by-show'],
  { revalidate: 1800, tags: ['episodes'] } // 30 min
)

// ---------------------------------------------------------------------------
// Series detail queries
// ---------------------------------------------------------------------------

export const getShowBySlug = unstable_cache(
  async (slug: string): Promise<DbShow | null> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('shows')
      .select('*')
      .eq('slug', slug)
      .eq('archived', false)
      .single()

    return data
  },
  ['show-by-slug'],
  { revalidate: 1800, tags: ['shows'] } // 30 min — show metadata rarely changes
)

export const getSeasonsByShowId = unstable_cache(
  async (showId: string): Promise<DbSeason[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('show_id', showId)
      .order('season_number', { ascending: true })

    return data ?? []
  },
  ['seasons-by-show'],
  { revalidate: 1800, tags: ['shows'] } // 30 min
)

export const getEpisodesBySeasonId = unstable_cache(
  async (seasonId: string): Promise<DbEpisode[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('episodes_view')
      .select('*')
      .eq('season_id', seasonId)
      .order('episode_number', { ascending: true })

    return (data ?? []) as unknown as DbEpisode[]
  },
  ['episodes-by-season'],
  { revalidate: 1800, tags: ['episodes'] } // 30 min
)

// ---------------------------------------------------------------------------
// Watch page queries
// ---------------------------------------------------------------------------

// Wrapped in React cache() so generateMetadata() and the page body share a
// single fetch per request. Before: the watch page ran episode + season + show
// fetches twice (once for metadata, once for render) because none of the three
// sub-queries were deduplicated across the render tree.
// unstable_cache is not right here — this query depends on user-specific auth
// cookies via createClient, and cached closures can't touch next/headers.
export const getEpisodeById = cache(async function getEpisodeById(episodeId: string) {
  const supabase = await createClient()

  // Read from the masking view: youtube_video_id comes back null unless the
  // episode is effectively live, and draft / non-public-show episodes are not
  // returned at all (→ 404). The watch page additionally redirects coming-soon
  // episodes whose time hasn't arrived.
  const { data: episodeRow } = await supabase
    .from('episodes_view')
    .select('*')
    .eq('id', episodeId)
    .single()

  if (!episodeRow) return null
  const episode = episodeRow as unknown as DbEpisode

  // Fetch season, show, and all seasons in parallel
  const [{ data: season }, { data: show }] = await Promise.all([
    supabase.from('seasons').select('*').eq('id', episode.season_id).single(),
    supabase.from('shows').select('*').eq('id', episode.show_id).single(),
  ])

  if (!season || !show) return null

  // Fetch seasons + ALL episodes for the show in parallel (2 queries, not 2N)
  const [seasons, allShowEpisodes] = await Promise.all([
    getSeasonsByShowId(show.id),
    getEpisodesByShowId(show.id),
  ])

  // Group episodes by season
  const episodesBySeason: Record<string, DbEpisode[]> = {}
  for (const s of seasons) {
    episodesBySeason[s.id] = allShowEpisodes.filter(e => e.season_id === s.id)
  }

  // Flatten published episodes for cross-season navigation
  const seasonNumberMap = new Map(seasons.map(s => [s.id, s.season_number]))
  const allEpisodes = allShowEpisodes
    .filter(e => isEpisodeLive(e.status, e.publish_at))
    .sort((a, b) => {
      const aSeason = seasonNumberMap.get(a.season_id) ?? 0
      const bSeason = seasonNumberMap.get(b.season_id) ?? 0
      if (aSeason !== bSeason) return aSeason - bSeason
      return a.episode_number - b.episode_number
    })

  const currentIdx = allEpisodes.findIndex(e => e.id === episodeId)
  const prev = currentIdx > 0 ? allEpisodes[currentIdx - 1] : null
  const next = currentIdx < allEpisodes.length - 1 ? allEpisodes[currentIdx + 1] : null

  return { episode, show, season, seasons, episodesBySeason, prev, next }
})

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

type ContinueWatchingRow = {
  progress_seconds: number
  duration_seconds: number | null
  episodes_view: {
    id: string
    title: string
    title_ar: string | null
    episode_number: number
    show_id: string
    show_title: string
    show_slug: string
    show_brand_color: string | null
    youtube_video_id: string | null
    seasons: { season_number: number }
    shows?: { title_ar: string | null } | null
  }
}

export async function getContinueWatchingEpisodes(
  userId: string,
  locale: Locale = DEFAULT_LOCALE
): Promise<ContinueWatchingItem[]> {
  const supabase = await createClient()
  // Filter archived episodes + shows at the DB level instead of in memory. The
  // !inner joins + .eq('joined.column', ...) push the predicate into the SQL
  // plan, so Postgres skips rows for archived shows/episodes before the
  // network boundary. Old code filtered client-side — it still worked, but
  // wasted bandwidth and CPU on progress rows we were about to drop anyway.
  const { data, error } = await supabase
    .from('watch_progress')
    .select(
      'progress_seconds, duration_seconds, episode_id, episodes_view!inner(id, title, title_ar, episode_number, status, archived, youtube_video_id, show_id, show_title, show_slug, show_brand_color, seasons!inner(season_number), shows!inner(title_ar))'
    )
    .eq('user_id', userId)
    .eq('completed', false)
    .gt('progress_seconds', 0)
    .eq('episodes_view.archived', false)
    .eq('episodes_view.status', 'published')
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[getContinueWatchingEpisodes]', error.message)
    return []
  }

  if (!data) return []

  const items = await Promise.all(
    (data as unknown as ContinueWatchingRow[]).slice(0, 10).map(async (row) => {
      const ep = row.episodes_view
      const dur = row.duration_seconds || 1
      const [episodeTitle, showTitle] = await Promise.all([
        localizedField(locale, ep.title, ep.title_ar),
        localizedField(locale, ep.show_title, ep.shows?.title_ar),
      ])
      return {
        episodeId: ep.id,
        episodeTitle,
        episodeNumber: ep.episode_number,
        seasonNumber: ep.seasons.season_number,
        showId: ep.show_id,
        showTitle,
        showSlug: ep.show_slug,
        showBrandColor: (ep.show_brand_color || 'brand-blue') as ViewShow['brandColor'],
        youtubeVideoId: ep.youtube_video_id ?? null,
        progressSeconds: row.progress_seconds,
        durationSeconds: dur,
        progressPercent: Math.min(Math.round((row.progress_seconds / dur) * 100), 99),
      }
    })
  )

  return items
}

// ---------------------------------------------------------------------------
// Genre query
// ---------------------------------------------------------------------------

export const getDistinctGenres = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('shows')
      .select('genre')
      .eq('archived', false)
      .in('status', ['now-streaming', 'coming-soon'])

    if (!data) return []
    return [...new Set(data.map((row) => row.genre))].sort()
  },
  ['distinct-genres'],
  { revalidate: 3600, tags: ['shows'] } // 1 hr
)

// ---------------------------------------------------------------------------
// Schedule query
// ---------------------------------------------------------------------------

export const getScheduleShows = unstable_cache(
  async (
    locale: Locale = DEFAULT_LOCALE
  ): Promise<
    (ViewShow & {
      broadcastDay: string[] | null
      broadcastTime: string | null
    })[]
  > => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('shows')
      .select('*')
      .eq('archived', false)
      .eq('status', 'now-streaming')
      .not('broadcast_day', 'is', null)
      .order('broadcast_day')

    const rows = data ?? []
    return Promise.all(
      rows.map(async (s) => ({
        ...(await mapShowLocalized(s, locale)),
        broadcastDay: s.broadcast_day,
        broadcastTime: s.broadcast_time,
      }))
    )
  },
  ['schedule-shows'],
  { revalidate: 3600, tags: ['shows'] } // 1 hr
)

// ---------------------------------------------------------------------------
// Coming soon episodes query
// ---------------------------------------------------------------------------

type ComingSoonRow = DbEpisode & {
  show_title: string
  show_slug: string
  show_brand_color: string
  shows?: { title_ar: string | null } | null
}

export const getComingSoonEpisodes = unstable_cache(
  async (
    locale: Locale = DEFAULT_LOCALE
  ): Promise<
    (ViewEpisode & { showTitle: string; showSlug: string; showBrandColor: ViewShow['brandColor'] })[]
  > => {
    const supabase = createPublicClient()
    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from('episodes_view')
      .select(
        'id, show_id, season_id, episode_number, title, title_ar, description, description_ar, duration, status, publish_at, archived, created_at, updated_at, show_title, show_slug, show_brand_color, show_status, shows!inner(title_ar)'
      )
      .eq('status', 'coming-soon')
      .in('show_status', ['now-streaming', 'coming-soon'])
      .or(`publish_at.is.null,publish_at.gt.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[getComingSoonEpisodes]', error.message)
      return []
    }

    return Promise.all(
      ((data ?? []) as unknown as ComingSoonRow[]).map(async (row) => {
        const episode = await mapEpisodeLocalized(row, locale)
        const showTitle = await localizedField(
          locale,
          row.show_title,
          row.shows?.title_ar
        )
        return {
          ...episode,
          showTitle,
          showSlug: row.show_slug,
          showBrandColor: row.show_brand_color as ViewShow['brandColor'],
        }
      })
    )
  },
  ['coming-soon-episodes'],
  { revalidate: 900, tags: ['episodes'] } // 15 min
)

// ---------------------------------------------------------------------------
// All shows query (for /series listing)
// ---------------------------------------------------------------------------

export const getAllShows = unstable_cache(
  async (locale: Locale = DEFAULT_LOCALE): Promise<ViewShow[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('shows')
      .select('*')
      .eq('archived', false)
      .in('status', ['now-streaming', 'coming-soon'])
      .order('title')

    return mapShowsLocalized(data ?? [], locale)
  },
  ['all-shows'],
  { revalidate: 3600, tags: ['shows'] } // 1 hr
)

// ---------------------------------------------------------------------------
// Shorts (Quick Bites) queries
// ---------------------------------------------------------------------------

export async function getWatchlistShows(
  userId: string,
  locale: Locale = DEFAULT_LOCALE
): Promise<ViewShow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('watchlist')
    .select('show_id, created_at, shows(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (!data) return []
  const shows = (data as unknown as { shows: DbShow | null }[])
    .map((row) => row.shows)
    .filter(Boolean) as DbShow[]
  return mapShowsLocalized(shows, locale)
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

type RecentlyWatchedRow = {
  progress_seconds: number
  duration_seconds: number | null
  completed: boolean
  updated_at: string
  episodes: {
    id: string
    title: string
    episode_number: number
    seasons: { season_number: number }
    shows: { title: string; slug: string; brand_color: string | null }
  }
}

export async function getRecentlyWatched(userId: string): Promise<RecentlyWatchedItem[]> {
  const supabase = await createClient()
  // Same archived-at-the-DB pattern as getContinueWatchingEpisodes above.
  const { data } = await supabase
    .from('watch_progress')
    .select('progress_seconds, duration_seconds, completed, updated_at, episode_id, episodes!inner(id, title, episode_number, status, archived, season_id, show_id, seasons!inner(season_number), shows!inner(title, slug, brand_color, archived))')
    .eq('user_id', userId)
    .eq('episodes.archived', false)
    .eq('episodes.status', 'published')
    .eq('episodes.shows.archived', false)
    .order('updated_at', { ascending: false })
    .limit(20)

  if (!data) return []

  return (data as unknown as RecentlyWatchedRow[])
    .slice(0, 10)
    .map((row) => {
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
): Promise<
  Record<
    string,
    {
      progressPercent: number
      completed: boolean
      progressSeconds: number
      durationSeconds: number
    }
  >
> {
  if (episodeIds.length === 0) return {}
  const supabase = await createClient()
  const { data } = await supabase
    .from('watch_progress')
    .select('episode_id, progress_seconds, duration_seconds, completed')
    .eq('user_id', userId)
    .in('episode_id', episodeIds)

  if (!data) return {}

  const result: Record<
    string,
    {
      progressPercent: number
      completed: boolean
      progressSeconds: number
      durationSeconds: number
    }
  > = {}
  for (const row of data) {
    const dur = row.duration_seconds || 1
    result[row.episode_id] = {
      progressPercent: Math.min(Math.round((row.progress_seconds / dur) * 100), 100),
      completed: row.completed,
      progressSeconds: row.progress_seconds,
      durationSeconds: row.duration_seconds ?? 0,
    }
  }
  return result
}

/**
 * Stored YouTube status of the given episodes, non-ok only (checker W1).
 * Server-only admin read: the status columns are not readable by anon or
 * authenticated, so the watch page asks here for ids it is already showing.
 * Returns status codes only. On a lookup error it returns {} so the player
 * tries anyway and the error-card path still applies.
 */
export async function getEpisodeYouTubeStatuses(
  episodeIds: string[]
): Promise<Record<string, StoredNonOkStatus>> {
  if (episodeIds.length === 0) return {}
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('episodes')
      .select('id, youtube_status')
      .in('id', episodeIds)
      .not('youtube_status', 'is', null)
      .neq('youtube_status', 'ok')
    if (error || !data) {
      console.error('[queries] youtube status lookup failed', error?.message)
      return {}
    }
    return toYouTubeStatusMap(data)
  } catch (err) {
    console.error('[queries] youtube status lookup failed', err)
    return {}
  }
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

export async function getWatchedShowIds(
  userId: string,
  showIds: string[]
): Promise<Set<string>> {
  if (showIds.length === 0) return new Set()
  const supabase = await createClient()
  const { data } = await supabase
    .from('watch_progress')
    .select('episodes!inner(show_id)')
    .eq('user_id', userId)
    .gt('progress_seconds', 0)
    .in('episodes.show_id', showIds)

  const watchedIds = new Set<string>()
  for (const row of data ?? []) {
    const showId = (row as unknown as { episodes?: { show_id?: string } | null }).episodes?.show_id
    if (showId) watchedIds.add(showId)
  }

  return watchedIds
}

// ---------------------------------------------------------------------------
// Likes queries
// ---------------------------------------------------------------------------

export async function getLikedShows(
  userId: string,
  locale: Locale = DEFAULT_LOCALE
): Promise<ViewShow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('likes')
    .select('show_id, created_at, shows(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (!data) return []
  const shows = (data as unknown as { shows: DbShow | null }[])
    .map((row) => row.shows)
    .filter(Boolean) as DbShow[]
  return mapShowsLocalized(shows, locale)
}

export async function getShowLikeState(userId: string, showId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('likes')
    .select('show_id')
    .eq('user_id', userId)
    .eq('show_id', showId)
    .maybeSingle()

  return !!data
}

// ---------------------------------------------------------------------------
// Catalog stage query
// ---------------------------------------------------------------------------

export type CatalogStage = 'zero' | 'growing' | 'full'

export const getCatalogStage = unstable_cache(
  async (): Promise<{ stage: CatalogStage; showCount: number }> => {
    const supabase = createPublicClient()
    const { count } = await supabase
      .from('shows')
      .select('*', { count: 'exact', head: true })
      .eq('archived', false)
      .in('status', ['now-streaming', 'coming-soon'])

    const showCount = count ?? 0
    const stage: CatalogStage =
      showCount === 0 ? 'zero' :
      showCount <= 5 ? 'growing' :
      'full'

    return { stage, showCount }
  },
  ['catalog-stage'],
  { revalidate: 3600, tags: ['shows'] }
)

// ---------------------------------------------------------------------------
// Shorts (Quick Bites) queries
// ---------------------------------------------------------------------------

export type DbShort = Database['public']['Tables']['shorts']['Row']

export type ViewShort = {
  id: string
  youtubeVideoId: string
  title: string
  channelName: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
  genre: string | null
  sortOrder: number
  expiresAt: string | null
  isFeatured: boolean
}

export function mapShort(db: DbShort): ViewShort {
  return {
    id: db.id,
    youtubeVideoId: db.youtube_video_id,
    title: db.title,
    channelName: db.channel_name,
    thumbnailUrl: db.thumbnail_url,
    durationSeconds: db.duration_seconds,
    genre: db.genre,
    sortOrder: db.sort_order ?? 0,
    expiresAt: db.expires_at,
    isFeatured: db.is_featured ?? false,
  }
}

export const getFeaturedShorts = unstable_cache(
  async (): Promise<ViewShort[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('shorts')
      .select('*')
      .eq('is_featured', true)
      .eq('archived', false)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('sort_order', { ascending: true })
      .limit(12)

    return (data ?? []).map(mapShort)
  },
  ['featured-shorts'],
  { revalidate: 900, tags: ['shorts'] }
)

export const getShortsForBrowse = unstable_cache(
  async (): Promise<ViewShort[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('shorts')
      .select('*')
      .eq('archived', false)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(20)

    return (data ?? []).map(mapShort)
  },
  ['shorts-browse'],
  { revalidate: 900, tags: ['shorts'] } // 15 min
)

// ---------------------------------------------------------------------------
// Public FAQ + Legal page queries — read from admin-managed DB tables.
// Both tables have "Public can read" RLS policies so createPublicClient() is
// correct (no cookie dependency).
//
// Intentionally NOT wrapped in unstable_cache: the admin actions call
// revalidatePath() after every save, which marks the ISR page cache stale.
// On the next request the page re-renders and these functions hit Supabase
// fresh — that is the "apply immediately on save" guarantee. Adding a
// persistent cache layer here would re-introduce the delay.
// ---------------------------------------------------------------------------

export type PublicFaq = {
  id: string
  question: string
  answer: string
  question_ar: string | null
  answer_ar: string | null
  sort_order: number
}

export async function getFaqsPublic(): Promise<PublicFaq[]> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('faqs')
    .select('id, question, answer, question_ar, answer_ar, sort_order')
    .order('sort_order', { ascending: true })
  return (data ?? []) as PublicFaq[]
}

export type PublicLegalPage = {
  id: string
  slug: string
  title: string
  content: string
  title_ar: string | null
  content_ar: string | null
  /** The Arabic is shown on /ar only when true (legalPageForLocale). The draft columns are not
   * selected here, and anon/authenticated cannot select them (column grant, 20261021120000). */
  ar_reviewed: boolean
  updated_at: string
}

export async function getLegalPageBySlug(slug: string): Promise<PublicLegalPage | null> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('legal_pages')
    .select('id, slug, title, content, title_ar, content_ar, ar_reviewed, updated_at')
    .eq('slug', slug)
    .single()
  return (data ?? null) as PublicLegalPage | null
}

export async function getAllLegalPages(): Promise<PublicLegalPage[]> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('legal_pages')
    .select('id, slug, title, content, title_ar, content_ar, ar_reviewed, updated_at')
    .order('sort_order', { ascending: true })
  return (data ?? []) as PublicLegalPage[]
}
