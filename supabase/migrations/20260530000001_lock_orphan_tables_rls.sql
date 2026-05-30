-- Security: lock down 3 tables that exist in prod but were created outside the
-- migration history (dashboard) and are referenced nowhere in app code (only in
-- generated database.types.ts). Enabling RLS with NO anon/authenticated policy
-- = default-deny for clients; the server's service_role still bypasses RLS.
-- IF EXISTS keeps this safe on a fresh migration-built DB where they don't exist.
ALTER TABLE IF EXISTS public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_notifications ENABLE ROW LEVEL SECURITY;
