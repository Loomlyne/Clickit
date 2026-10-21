-- ============================================================
-- Phase 5 M3. Apply only after the catalog client (05-05) is deployed.
--
-- Ships in the second PR (prepared in 05-41) and is applied in 05-37 in ONE
-- approval together with M2. Before 05-05 the four catalog queries read
-- episodes_view with the anon key; since 05-05 they use the server-only
-- service-role client (src/server/catalog-client.ts), so closing anon here
-- cannot empty the catalog (research F1).
--
-- What changes:
--   * anon (and PUBLIC) lose EXECUTE on public.get_public_youtube_video_id,
--     so the anon key can no longer turn an episode id into a YouTube id.
--   * anon loses SELECT on public.episodes_view (the view calls that
--     function per row).
--   * authenticated and service_role keep both. The view grants below only
--     restate what 20260724115941 and the Supabase defaults already give
--     (checked on the local stack 2026-10-21: authenticated SELECT,
--     service_role SELECT and the other default table privileges); nothing is
--     widened.
--
-- 05-41 copies this file byte for byte to
-- supabase/migrations/<new timestamp>_phase5_m3_close_anon_youtube.sql.
-- Proof: supabase/tests/pending_anon_revoke.sql (scripts/db-proof.sh).
-- ============================================================

revoke execute on function public.get_public_youtube_video_id(uuid) from public, anon;
grant execute on function public.get_public_youtube_video_id(uuid) to authenticated, service_role;

revoke select on table public.episodes_view from anon;
grant select on table public.episodes_view to authenticated, service_role;
