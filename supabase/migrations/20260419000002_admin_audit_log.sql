-- Admin audit log: records every mutation performed via admin Server Actions.
--
-- Answers: "who changed show X?" "when did the coming-soon flag flip?"
-- "who deleted season 3 of Voyage?"
--
-- Design:
--   admin_user_id  — the auth.users.id who performed the action. Kept as a
--                    plain uuid (no FK to auth.users) so audit rows survive if
--                    an admin account is later deleted — accountability shouldn't
--                    vanish with the actor.
--   action_type    — 'create' | 'update' | 'archive' | 'restore' | 'delete' |
--                    'config_update'. Free-form text (no enum) so we can add
--                    new categories without migrations.
--   entity_type    — 'show' | 'season' | 'episode' | 'app_config' | 'storage' |
--                    'feature_flags' (again, free-form)
--   entity_id      — uuid of the row affected. NULL for entity_type='app_config'
--                    (singleton) or storage operations.
--   diff           — jsonb {before, after} snapshot for updates, just {data}
--                    for creates, just {id} for deletes. Logger picks the
--                    shape that's useful; reader UI is flexible.
--   created_at     — server timestamp. No updated_at column: audit rows are
--                    immutable by policy.
--
-- Storage cost: ~15 mutations/day * 365 days = ~5500 rows/year. Each row is
-- ~1KB (diff dominates). ~5MB/year. Negligible. No TTL needed short-term.
-- Add a cleanup cron if this grows past 1M rows.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Most dashboard reads filter "show me what admin X did lately" or "recent
-- activity across the whole system" — both are served by a created_at DESC
-- scan. admin_user_id is the secondary filter axis.
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id_created_at
  ON public.admin_audit_log (admin_user_id, created_at DESC);
-- "What happened to this show?" lookup — narrow by entity
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity
  ON public.admin_audit_log (entity_type, entity_id, created_at DESC)
  WHERE entity_id IS NOT NULL;

-- RLS: only admin can read the audit log. No one can write via the client —
-- inserts must come from Server Actions using the service role.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read audit log"
  ON public.admin_audit_log
  FOR SELECT
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies defined → no client write access.
-- Server Actions use createAdminClient() (service role) which bypasses RLS.
