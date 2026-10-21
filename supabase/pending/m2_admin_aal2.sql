-- ============================================================
-- Phase 5 M2. Apply only after the Phase 5 deploy and after both admins rows
-- are inserted and read back (05-36), via the second PR (prepared in 05-41,
-- applied in 05-37 together with M3 in one approval); TOTP enrolment follows.
--
-- Signed order (D-16 / D-40): M1 -> deploy -> accounts -> admins rows read
-- back -> M2 + M3 -> TOTP enrolment. Between M2 and enrolment the admin pages
-- show nothing (accepted window): requireAdmin sends an admin without a
-- verified factor to the enrol page first.
--
-- What changes:
--   * private.is_admin() keeps its name, signature, SECURITY DEFINER,
--     search_path and grants (CREATE OR REPLACE keeps the ACL). Its body moves
--     from "auth.uid() = app_config.admin_user_id" to "a row in public.admins
--     for auth.uid() AND the session JWT says aal = 'aal2'". The 35 public and
--     3 storage policies that already call it change with it, no rewrite.
--     app_config.admin_user_id stays (unused) until the Phase 8 contract.
--   * The one storage policy that checked admin inline ("Admin manage
--     site-assets", 20260416000000_add_hero_video.sql) is recreated with the
--     same command (ALL), role (authenticated) and bucket filter, calling
--     private.is_admin() instead of reading app_config.
--
-- 05-41 copies this file byte for byte to
-- supabase/migrations/<new timestamp>_phase5_m2_admin_aal2.sql.
-- Proof: supabase/tests/pending_admin_aal2.sql (scripts/db-proof.sh).
-- ============================================================

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins a
    where a.user_id = (select auth.uid())
  )
  and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
$$;

drop policy if exists "Admin manage site-assets" on storage.objects; -- safe-drop: recreated in the next statement with private.is_admin()
create policy "Admin manage site-assets"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'site-assets'
    and (select private.is_admin())
  )
  with check (
    bucket_id = 'site-assets'
    and (select private.is_admin())
  );
