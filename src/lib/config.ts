import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'

// ---------------------------------------------------------------------------
// Shape of the admin-controlled site config (backed by app_config row id=1).
// JSONB columns are typed strictly here; the DB stores them as jsonb so the
// shape can evolve without migrations, but the app treats them as typed.
// ---------------------------------------------------------------------------

export type SocialLinkItem = {
  platform: string
  url: string
  iconUrl: string
}

export type FooterContent = {
  tagline: string
  /** Arabic footer tagline. Shown when locale is ar; falls back to tagline when empty. */
  taglineAr: string
  stat: string
  contactEmail: string
  social: SocialLinkItem[]
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
  tag2?: string
  /** Arabic variants. Shown when locale is ar; fall back to the English fields when empty. */
  tag_ar?: string
  text_ar?: string
  tag2_ar?: string
}

export type TopTickerConfig = {
  enabled: boolean
  items: TopTickerItem[]
}

export type AppConfig = {
  // Branding / SEO
  siteTitle: string
  siteDescription: string | null
  /** Arabic SEO/meta description. Shown when locale is ar; falls back to siteDescription. */
  siteDescriptionAr: string | null
  siteTagline: string
  /** Arabic site tagline. Shown when locale is ar; falls back to siteTagline. */
  siteTaglineAr: string | null
  ogImageUrl: string | null
  faviconUrl: string | null
  /** Dark-mode favicon variant. Served via prefers-color-scheme: dark; falls back to faviconUrl. */
  faviconDarkUrl: string | null
  // Hero video (existing) — desktop / horizontal 16:9
  heroVideoUrl: string | null
  heroVideoType: 'mp4' | 'youtube' | null
  // Hero video — mobile / vertical 9:16 (falls back to desktop when unset)
  heroVideoMobileUrl: string | null
  heroVideoMobileType: 'mp4' | 'youtube' | null
  heroVideoMuted: boolean
  // Sign-in page — admin-editable image, copy (EN/AR) and OAuth toggles
  authImageUrl: string | null
  authHeading: string | null
  authHeadingAr: string | null
  authSubheading: string | null
  authSubheadingAr: string | null
  authQuote: string | null
  authQuoteAr: string | null
  authQuoteAttribution: string | null
  authQuoteAttributionAr: string | null
  // When true, the auth page shows a "Skip sign-in" link and signed-out
  // visitors may browse the site (but watch routes still require an account).
  authAllowSkip: boolean
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
  /** Landing hero paragraph below the logo. Null means use the i18n fallback. */
  heroDescription: string | null
  /** Arabic landing hero paragraph. Shown when locale is ar; null falls back to i18n. */
  heroDescriptionAr: string | null
  /** Heading above the shows grid on the landing/portfolio page. Null falls back to i18n. */
  portfolioHeading: string | null
  /** Arabic heading above the shows grid. Shown when locale is ar; null falls back to i18n. */
  portfolioHeadingAr: string | null
}

// ---------------------------------------------------------------------------
// Defaults — used when a column is null/undefined (newly added rows, tests).
// Keeping them in code means the landing page always renders something sane
// even on a fresh DB.
// ---------------------------------------------------------------------------

export const DEFAULT_FOOTER: FooterContent = {
  tagline: 'Clickit brings original programs from Abu Dhabi to viewers worldwide.',
  taglineAr: '',
  stat: '15 original programs',
  contactEmail: '',
  social: [],
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
        'site_title, site_description, site_description_ar, site_tagline, site_tagline_ar, og_image_url, favicon_url, favicon_dark_url, hero_video_url, hero_video_type, hero_video_mobile_url, hero_video_mobile_type, hero_video_muted, auth_image_url, auth_heading, auth_heading_ar, auth_subheading, auth_subheading_ar, auth_quote, auth_quote_ar, auth_quote_attribution, auth_quote_attribution_ar, auth_allow_skip, footer_content, cta_copy, genre_config, google_analytics_id, meta_pixel_id, feature_flags, top_ticker, live_stream_url, hero_description, hero_description_ar, portfolio_heading, portfolio_heading_ar' as string
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
  site_description_ar: string | null
  site_tagline: string | null
  site_tagline_ar: string | null
  og_image_url: string | null
  favicon_url: string | null
  favicon_dark_url: string | null
  hero_video_url: string | null
  hero_video_type: string | null
  hero_video_mobile_url: string | null
  hero_video_mobile_type: string | null
  hero_video_muted: boolean | null
  auth_image_url: string | null
  auth_heading: string | null
  auth_heading_ar: string | null
  auth_subheading: string | null
  auth_subheading_ar: string | null
  auth_quote: string | null
  auth_quote_ar: string | null
  auth_quote_attribution: string | null
  auth_quote_attribution_ar: string | null
  auth_allow_skip: boolean | null
  footer_content: unknown
  cta_copy: unknown
  genre_config: unknown
  google_analytics_id: string | null
  meta_pixel_id: string | null
  feature_flags: unknown
  top_ticker: unknown
  live_stream_url: string | null
  hero_description: string | null
  hero_description_ar: string | null
  portfolio_heading: string | null
  portfolio_heading_ar: string | null
} | null

function mapConfig(row: RawConfigRow): AppConfig {
  return {
    siteTitle: row?.site_title ?? 'Clickit Story',
    siteDescription: row?.site_description ?? null,
    siteDescriptionAr: row?.site_description_ar ?? null,
    siteTagline: row?.site_tagline ?? 'Every Story Clicks.',
    siteTaglineAr: row?.site_tagline_ar ?? null,
    ogImageUrl: row?.og_image_url ?? null,
    faviconUrl: row?.favicon_url ?? null,
    faviconDarkUrl: row?.favicon_dark_url ?? null,
    heroVideoUrl: row?.hero_video_url ?? null,
    heroVideoType: (row?.hero_video_type as 'mp4' | 'youtube' | null) ?? null,
    heroVideoMobileUrl: row?.hero_video_mobile_url ?? null,
    heroVideoMobileType:
      (row?.hero_video_mobile_type as 'mp4' | 'youtube' | null) ?? null,
    heroVideoMuted: row?.hero_video_muted ?? true,
    authImageUrl: row?.auth_image_url ?? null,
    authHeading: row?.auth_heading ?? null,
    authHeadingAr: row?.auth_heading_ar ?? null,
    authSubheading: row?.auth_subheading ?? null,
    authSubheadingAr: row?.auth_subheading_ar ?? null,
    authQuote: row?.auth_quote ?? null,
    authQuoteAr: row?.auth_quote_ar ?? null,
    authQuoteAttribution: row?.auth_quote_attribution ?? null,
    authQuoteAttributionAr: row?.auth_quote_attribution_ar ?? null,
    authAllowSkip: row?.auth_allow_skip ?? false,
    footer: mergeFooter(row?.footer_content),
    ctaCopy: mergeCta(row?.cta_copy),
    genreConfig: isObject(row?.genre_config) ? (row!.genre_config as GenreConfig) : {},
    googleAnalyticsId: row?.google_analytics_id ?? null,
    metaPixelId: row?.meta_pixel_id ?? null,
    flags: mergeFlags(row?.feature_flags),
    topTicker: mergeTopTicker(row?.top_ticker),
    liveStreamUrl: row?.live_stream_url ?? null,
    heroDescription: row?.hero_description ?? null,
    heroDescriptionAr: row?.hero_description_ar ?? null,
    portfolioHeading: row?.portfolio_heading ?? null,
    portfolioHeadingAr: row?.portfolio_heading_ar ?? null,
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function mergeFooter(v: unknown): FooterContent {
  if (!isObject(v)) return DEFAULT_FOOTER
  const legal = isObject(v.legal) ? (v.legal as Record<string, unknown>) : {}

  // Migrate old fixed-key format → array
  let social: SocialLinkItem[] = []
  if (Array.isArray(v.social)) {
    social = (v.social as unknown[]).flatMap((item) => {
      if (
        isObject(item) &&
        typeof item.platform === 'string' &&
        typeof item.url === 'string' &&
        item.url !== ''
      ) {
        return [{
          platform: item.platform,
          url: item.url,
          iconUrl: typeof item.iconUrl === 'string' ? item.iconUrl : '',
        }]
      }
      return []
    })
  } else if (isObject(v.social)) {
    // Old format: { instagram: '...', x: '...', youtube: '...', tiktok: '...' }
    const old = v.social as Record<string, unknown>
    const order = ['instagram', 'x', 'youtube', 'tiktok']
    for (const key of order) {
      if (typeof old[key] === 'string' && old[key] !== '') {
        social.push({ platform: key, url: old[key] as string, iconUrl: '' })
      }
    }
  }

  return {
    tagline: typeof v.tagline === 'string' ? v.tagline : DEFAULT_FOOTER.tagline,
    taglineAr: typeof v.taglineAr === 'string' ? v.taglineAr : '',
    stat: typeof v.stat === 'string' ? v.stat : DEFAULT_FOOTER.stat,
    contactEmail: typeof v.contactEmail === 'string' ? v.contactEmail : '',
    social,
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
      const tag2Raw = typeof entry.tag2 === 'string' ? entry.tag2.trim() : ''
      const tagAr = typeof entry.tag_ar === 'string' ? entry.tag_ar.trim().slice(0, 24) : ''
      const textAr = typeof entry.text_ar === 'string' ? entry.text_ar.trim().slice(0, 240) : ''
      const tag2Ar = typeof entry.tag2_ar === 'string' ? entry.tag2_ar.trim().slice(0, 24) : ''
      if (tag || text || tag2Raw)
        items.push({
          tag,
          text,
          ...(tag2Raw && { tag2: tag2Raw.slice(0, 24) }),
          ...(tagAr && { tag_ar: tagAr }),
          ...(textAr && { text_ar: textAr }),
          ...(tag2Ar && { tag2_ar: tag2Ar }),
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
