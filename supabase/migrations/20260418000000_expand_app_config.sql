-- ============================================================
-- Expand app_config for admin settings control center
--
-- Adds:
--   - Branding/SEO: site_title, site_description, site_tagline,
--     og_image_url, favicon_url
--   - Content (JSONB): footer_content, cta_copy, genre_config
--   - Integrations: google_analytics_id, meta_pixel_id, youtube_api_key
--   - Feature flags (JSONB): feature_flags
--
-- Also widens site-assets bucket mime types to include images
-- so the same bucket + RLS policy covers OG image and favicon.
-- ============================================================

alter table public.app_config
  -- Branding / SEO
  add column if not exists site_title        text default 'Clickit Story',
  add column if not exists site_description  text,
  add column if not exists site_tagline      text default 'Every Story Clicks.',
  add column if not exists og_image_url      text,
  add column if not exists favicon_url       text,

  -- Structured content editors
  add column if not exists footer_content jsonb not null default jsonb_build_object(
    'tagline',      'Clickit brings original programs from Abu Dhabi to viewers worldwide.',
    'stat',         '15 original programs',
    'contactEmail', '',
    'social',       jsonb_build_object('instagram','', 'x','', 'youtube','', 'tiktok',''),
    'legal',        jsonb_build_object('privacy','', 'terms','', 'cookies','')
  ),

  -- CTA copy seeded with the current hardcoded strings from
  -- src/components/home/cta-banner.tsx so the admin editor opens with
  -- the real shipping copy already filled in.
  add column if not exists cta_copy jsonb not null default jsonb_build_object(
    'zero', jsonb_build_object(
      'label',          'Coming soon',
      'headline',       'Be there',
      'headlineB',      'when CIT premieres.',
      'body',           'Original series are arriving soon. Create your account now and be first to watch.',
      'primaryLabel',   'Create Free Account',
      'primaryHref',    '/auth',
      'secondaryLabel', 'See what''s coming →',
      'secondaryHref',  '/coming-soon'
    ),
    'growing', jsonb_build_object(
      'label',          'Now streaming',
      'headline',       'The catalog',
      'headlineB',      'has begun.',
      'body',           'Watch the first stories on CIT and save your favorites for later.',
      'primaryLabel',   'Start Watching',
      'primaryHref',    '/browse',
      'secondaryLabel', 'See what''s coming →',
      'secondaryHref',  '/coming-soon'
    ),
    'full', jsonb_build_object(
      'label',          'Free · No subscription',
      'headline',       'Original stories',
      'headlineB',      'from Abu Dhabi.',
      'body',           'Travel, health, music, comedy, cooking, and more — crafted to let the stories lead.',
      'primaryLabel',   'Start Watching Free',
      'primaryHref',    '/browse',
      'secondaryLabel', 'What''s coming next →',
      'secondaryHref',  '/coming-soon'
    )
  ),

  -- Per-genre overrides: { "Entertainment": { "color": "purple", "order": 1, "hidden": false } }
  add column if not exists genre_config jsonb not null default '{}'::jsonb,

  -- Integrations (YouTube key is sensitive — see RLS below)
  add column if not exists google_analytics_id text,
  add column if not exists meta_pixel_id       text,
  add column if not exists youtube_api_key     text,

  -- Feature flags / section toggles
  add column if not exists feature_flags jsonb not null default jsonb_build_object(
    'showGenresGrid',  true,
    'showCtaBanner',   true,
    'showFaq',         true,
    'comingSoonMode',  false
  );

-- ============================================================
-- RLS: protect sensitive columns
--
-- The app_config table already has RLS enabled. Existing policies
-- typically allow public SELECT on non-sensitive config for the
-- landing page. We re-state policies here to:
--   1. Allow public SELECT on non-sensitive config.
--   2. Forbid public SELECT of youtube_api_key by using a column-
--      level privilege REVOKE (defense in depth).
--   3. Admin can do anything (already covered by existing admin
--      policy using admin_user_id check).
--
-- NOTE: Postgres column-level privileges apply to the `anon` and
-- `authenticated` roles; they do NOT override RLS but add a second
-- layer. RLS alone is not enough because anyone with a valid JWT
-- could otherwise read the column if the row is visible.
-- ============================================================

-- Revoke column privileges from public roles (defense in depth).
-- Admin server actions use the service_role key which bypasses this.
revoke select (youtube_api_key) on public.app_config from anon, authenticated;

-- ============================================================
-- Widen site-assets bucket: allow image uploads for OG/favicon
-- ============================================================
update storage.buckets
set allowed_mime_types = array[
  'video/mp4',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/x-icon',
  'image/svg+xml'
]
where id = 'site-assets';
