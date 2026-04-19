-- Add CHECK constraints on app_config JSONB columns so a malformed admin save
-- fails at the DB boundary instead of crashing a viewer page at render time.
--
-- Shapes were audited against production on 2026-04-19 via the Supabase MCP.
-- The constraints below are the minimum-viable invariants that viewer code
-- already assumes. They don't try to validate every nested key — just the
-- top-level structure that would cause a runtime TypeError if missing.
--
-- Relaxation strategy: if a future schema change needs to remove a required
-- key, drop the constraint in the same migration that changes the shape.
-- Never loosen a constraint without also updating the reader — that's how you
-- end up with silent data drift.

-- cta_copy: viewer reads cta_copy.zero, cta_copy.growing, cta_copy.full based
-- on catalog state (src/components/landing/cta-banner.tsx). All three slots
-- must exist.
ALTER TABLE public.app_config
  ADD CONSTRAINT app_config_cta_copy_shape CHECK (
    cta_copy ? 'zero'
    AND cta_copy ? 'growing'
    AND cta_copy ? 'full'
  );

-- footer_content: footer reads tagline, stat, social.{instagram,x,youtube},
-- legal.{privacy,terms,cookies}, contactEmail (src/components/layout/footer.tsx).
-- Just validate the top-level nesting — empty strings inside are fine (the
-- SocialLink helper returns null for empty href).
ALTER TABLE public.app_config
  ADD CONSTRAINT app_config_footer_content_shape CHECK (
    footer_content ? 'tagline'
    AND footer_content ? 'social'
    AND footer_content ? 'legal'
  );

-- feature_flags: middleware reads flags.comingSoonMode, landing reads
-- showFaq/showCtaBanner/showGenresGrid. All four must be booleans.
ALTER TABLE public.app_config
  ADD CONSTRAINT app_config_feature_flags_shape CHECK (
    jsonb_typeof(feature_flags -> 'comingSoonMode') = 'boolean'
    AND jsonb_typeof(feature_flags -> 'showFaq') = 'boolean'
    AND jsonb_typeof(feature_flags -> 'showCtaBanner') = 'boolean'
    AND jsonb_typeof(feature_flags -> 'showGenresGrid') = 'boolean'
  );

-- genre_config is intentionally not constrained — it's a free-form map of
-- { [genreName]: { color, icon } } entries that the admin builds up over
-- time. Reader code (src/components/admin/settings/genre-color-editor.tsx)
-- tolerates missing entries.
