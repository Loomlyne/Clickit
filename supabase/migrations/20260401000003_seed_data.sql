-- ============================================================
-- CIT Platform Seed Data
-- Phase 6: Backend Foundation
-- ============================================================
-- Phase 1 (SAFE-01, 2026-10-20): the fake shows, seasons and episodes
-- moved to supabase/seed.sql (local `supabase db reset` only). This
-- version is already recorded on live, so the file and version are kept.
-- Only the initial app_config row (per D-09) remains here.
-- ============================================================

-- Initial app_config row (per D-09)
-- admin_user_id is NULL until admin signs up and UUID is set.
-- After first admin signup, run:
--   UPDATE public.app_config SET admin_user_id = '<admin-supabase-uuid>' WHERE id = 1;
-- Or use the ADMIN_USER_ID env var from .env.local via the admin client.
INSERT INTO public.app_config (id, admin_user_id)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;
