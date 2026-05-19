import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'

// ---------------------------------------------------------------------------
// Shape of the admin-controlled site config (backed by app_config row id=1).
// JSONB columns are typed strictly here; the DB stores them as jsonb so the
// shape can evolve without migrations, but the app treats them as typed.
// ---------------------------------------------------------------------------

export type FooterContent = {
  tagline: string
  stat: string
  contactEmail: string
  social: {
    instagram: string
    x: string
    youtube: string
    tiktok: string
  }
  legal: {
    privacy: string
    terms: string
    cookies: string
  }
}

export type CtaStageCopy = {
  label: string         // small eyebrow text, e.g. "Now streaming"
  headline: string      // bold top line
  headlineB: string     // dimmed continuation line
  body: string          // paragraph body
  primaryLabel: string  // main CTA button text
  primaryHref: string   // main CTA link
  secondaryLabel: string
  secondaryHref: string
}

export type CtaCopy = {
  zero: CtaStageCopy
  growing: CtaStageCopy
  full: CtaStageCopy
}

export type GenreOverride = {
  color?: string
  order?: number
  hidden?: boolean
}

export type GenreConfig = Record<string, GenreOverride>

export type FeatureFlags = {
  showGenresGrid: boolean
  showCtaBanner: boolean
  showFaq: boolean
  comingSoonMode: boolean
}

export type TopTickerItem = {
  tag: string
  text: string
  tag_ar?: string
  text_ar?: string
}

export type TopTickerConfig = {
  enabled: boolean
  items: TopTickerItem[]
}

export type AppConfig = {
  // Branding / SEO
  siteTitle: string
  siteDescription: string | null
  siteTagline: string
  ogImageUrl: string | null
  faviconUrl: string | null
  // Hero video (existing)
  heroVideoUrl: string | null
  heroVideoType: 'mp4' | 'youtube' | null
  // Structured content
  footer: FooterContent
  ctaCopy: CtaCopy
  genreConfig: GenreConfig
  // Integrations — note: youtubeApiKey is NEVER included in public reads
  googleAnalyticsId: string | null
  metaPixelId: string | null
  // Feature flags
  flags: FeatureFlags
  // Viewer chrome — scrolling news bar above navbar
  topTicker: TopTickerConfig
  /** Optional YouTube (or same-host) live stream; nav falls back to /watch#now-streaming when null. */
  liveStreamUrl: string | null
}

// ---------------------------------------------------------------------------
// Defaults — used when a column is null/undefined (newly added rows, tests).
// Keeping them in code means the landing page always renders something sane
// even on a fresh DB.
// ---------------------------------------------------------------------------

export const DEFAULT_FOOTER: FooterContent = {
  tagline: 'Clickit brings original programs from Abu Dhabi to viewers worldwide.',
  stat: '15 original programs',
  contactEmail: '',
  social: { instagram: '', x: '', youtube: '', tiktok: '' },
  legal: { privacy: '', terms: '', cookies: '' },
}

// Seeded defaults mirror the current hardcoded CTA_COPY in cta-banner.tsx,
// so when the migration runs the admin editor opens with the real shipping copy.
export const DEFAULT_CTA_COPY: CtaCopy = {
  zero: {
    label: 'Coming soon',
    headline: 'Be there',
    headlineB: 'when CIT premieres.',
    body: 'Original series are arriving soon. Create your account now and be first to watch.',
    primaryLabel: 'Create Free Account',
    primaryHref: '/auth',
    secondaryLabel: "See what's coming →",
    secondaryHref: '/coming-soon',
  },
  growing: {
    label: 'Now streaming',
    headline: 'The catalog',
    headlineB: 'has begun.',
    body: 'Watch the first stories on CIT and save your favorites for later.',
    primaryLabel: 'Start Watching',
    primaryHref: '/watch',
    secondaryLabel: "See what's coming →",
    secondaryHref: '/coming-soon',
  },
  full: {
    label: 'Free · No subscription',
    headline: 'Original stories',
    headlineB: 'from Abu Dhabi.',
    body: 'Travel, health, music, comedy, cooking, and more — crafted to let the stories lead.',
    primaryLabel: 'Start Watching Free',
    primaryHref: '/watch',
    secondaryLabel: "What's coming next →",
    secondaryHref: '/coming-soon',
  },
}

export const DEFAULT_FLAGS: FeatureFlags = {
  showGenresGrid: true,
  showCtaBanner: true,
  showFaq: true,
  comingSoonMode: false,
}

export const DEFAULT_TOP_TICKER: TopTickerConfig = {
  enabled: true,
  items: [
    { tag: 'NEW', text: 'Original shows · premiering now' },
    { tag: 'LIVE', text: 'Streaming from Abu Dhabi' },
    { tag: 'SHORT', text: 'Quick bites · 90-second cuts' },
    { tag: 'EST 2026', text: 'Clickit · Hand-picked, no algorithm' },
  ],
}

// ---------------------------------------------------------------------------
// getAppConfig() — cached public read.
//
// - Uses the cookie-free createPublicClient (unstable_cache forbids next/headers).
// - NEVER selects youtube_api_key (column privilege revoked for anon/auth).
// - Tagged 'site-config' (same tag as getHeroVideo) so one updateTag call
//   invalidates the whole site config on save.
// ---------------------------------------------------------------------------

// React cache() wraps unstable_cache to dedupe repeat calls within ONE request.
// LocaleLayout calls this twice per render: once in generateMetadata() for SEO
// tags, once in the body for googleAnalyticsId/metaPixelId. Each call without
// cache() is a separate Vercel data-cache lookup. With cache(), the second
// call returns the memoized result instantly.
export const getAppConfig = cache(unstable_cache(
  async (): Promise<AppConfig> => {
    const supabase = createPublicClient()
    // Select every non-sensitive column explicitly. youtube_api_key is
    // deliberately omitted.
    const { data } = await supabase
      .from('app_config')
      .select(
        'site_title, site_description, site_tagline, og_image_url, favicon_url, hero_video_url, hero_video_type, footer_content, cta_copy, genre_config, google_analytics_id, meta_pixel_id, feature_flags, top_ticker, live_stream_url' as string
      )
      .eq('id', 1)
      .single<RawConfigRow>()

    return mapConfig(data)
  },
  ['app-config-v2'],
  { revalidate: 900, tags: ['site-config'] } // 15 min
))

// ---------------------------------------------------------------------------
// Internal shape (raw DB row) — declared locally because generated types may
// not yet include the new columns until `supabase gen types` is re-run.
// ---------------------------------------------------------------------------

type RawConfigRow = {
  site_title: string | null
  site_description: string | null
  site_tagline: string | null
  og_image_url: string | null
  favicon_url: string | null
  hero_video_url: string | null
  hero_video_type: string | null
  footer_content: unknown
  cta_copy: unknown
  genre_config: unknown
  google_analytics_id: string | null
  meta_pixel_id: string | null
  feature_flags: unknown
  top_ticker: unknown
  live_stream_url: string | null
} | null

function mapConfig(row: RawConfigRow): AppConfig {
  return {
    siteTitle: row?.site_title ?? 'Clickit Story',
    siteDescription: row?.site_description ?? null,
    siteTagline: row?.site_tagline ?? 'Every Story Clicks.',
    ogImageUrl: row?.og_image_url ?? null,
    faviconUrl: row?.favicon_url ?? null,
    heroVideoUrl: row?.hero_video_url ?? null,
    heroVideoType: (row?.hero_video_type as 'mp4' | 'youtube' | null) ?? null,
    footer: mergeFooter(row?.footer_content),
    ctaCopy: mergeCta(row?.cta_copy),
    genreConfig: isObject(row?.genre_config) ? (row!.genre_config as GenreConfig) : {},
    googleAnalyticsId: row?.google_analytics_id ?? null,
    metaPixelId: row?.meta_pixel_id ?? null,
    flags: mergeFlags(row?.feature_flags),
    topTicker: mergeTopTicker(row?.top_ticker),
    liveStreamUrl: row?.live_stream_url ?? null,
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function mergeFooter(v: unknown): FooterContent {
  if (!isObject(v)) return DEFAULT_FOOTER
  const social = isObject(v.social) ? (v.social as Record<string, unknown>) : {}
  const legal = isObject(v.legal) ? (v.legal as Record<string, unknown>) : {}
  return {
    tagline: typeof v.tagline === 'string' ? v.tagline : DEFAULT_FOOTER.tagline,
    stat: typeof v.stat === 'string' ? v.stat : DEFAULT_FOOTER.stat,
    contactEmail: typeof v.contactEmail === 'string' ? v.contactEmail : '',
    social: {
      instagram: typeof social.instagram === 'string' ? social.instagram : '',
      x: typeof social.x === 'string' ? social.x : '',
      youtube: typeof social.youtube === 'string' ? social.youtube : '',
      tiktok: typeof social.tiktok === 'string' ? social.tiktok : '',
    },
    legal: {
      privacy: typeof legal.privacy === 'string' ? legal.privacy : '',
      terms: typeof legal.terms === 'string' ? legal.terms : '',
      cookies: typeof legal.cookies === 'string' ? legal.cookies : '',
    },
  }
}

function mergeCta(v: unknown): CtaCopy {
  const pickStage = (stage: unknown, fallback: CtaStageCopy): CtaStageCopy => {
    if (!isObject(stage)) return fallback
    const str = (key: keyof CtaStageCopy) =>
      typeof stage[key] === 'string' ? (stage[key] as string) : fallback[key]
    return {
      label: str('label'),
      headline: str('headline'),
      headlineB: str('headlineB'),
      body: str('body'),
      primaryLabel: str('primaryLabel'),
      primaryHref: str('primaryHref'),
      secondaryLabel: str('secondaryLabel'),
      secondaryHref: str('secondaryHref'),
    }
  }
  if (!isObject(v)) return DEFAULT_CTA_COPY
  return {
    zero: pickStage(v.zero, DEFAULT_CTA_COPY.zero),
    growing: pickStage(v.growing, DEFAULT_CTA_COPY.growing),
    full: pickStage(v.full, DEFAULT_CTA_COPY.full),
  }
}

function mergeFlags(v: unknown): FeatureFlags {
  if (!isObject(v)) return DEFAULT_FLAGS
  return {
    showGenresGrid: v.showGenresGrid !== false,
    showCtaBanner: v.showCtaBanner !== false,
    showFaq: v.showFaq !== false,
    comingSoonMode: v.comingSoonMode === true,
  }
}

function mergeTopTicker(v: unknown): TopTickerConfig {
  if (!isObject(v)) return DEFAULT_TOP_TICKER
  const enabled = v.enabled !== false
  const rawItems = v.items
  const items: TopTickerItem[] = []
  if (Array.isArray(rawItems)) {
    for (const entry of rawItems) {
      if (!isObject(entry)) continue
      const tagRaw = typeof entry.tag === 'string' ? entry.tag.trim() : ''
      const textRaw = typeof entry.text === 'string' ? entry.text.trim() : ''
      const tag = tagRaw.slice(0, 24)
      const text = textRaw.slice(0, 240)
      const tagArRaw = typeof entry.tag_ar === 'string' ? entry.tag_ar.trim() : ''
      const textArRaw = typeof entry.text_ar === 'string' ? entry.text_ar.trim() : ''
      if (tag && text)
        items.push({
          tag,
          text,
          ...(tagArRaw && { tag_ar: tagArRaw.slice(0, 24) }),
          ...(textArRaw && { text_ar: textArRaw.slice(0, 240) }),
        })
    }
  }
  return {
    enabled,
    items: items.length > 0 ? items : DEFAULT_TOP_TICKER.items,
  }
}

// ---------------------------------------------------------------------------
// Admin-only helper: reads the server-side-only youtube_api_key.
// Called from server actions / API routes that run with service-role access
// OR from the admin-authenticated supabase server client.
// ---------------------------------------------------------------------------

export async function getYouTubeApiKey(): Promise<string | null> {
  // Uses the admin client (service role) to bypass the column REVOKE.
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_config')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select('youtube_api_key' as any)
    .eq('id', 1)
    .single<{ youtube_api_key: string | null }>()
  return data?.youtube_api_key ?? null
}
