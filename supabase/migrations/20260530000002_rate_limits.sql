-- Security/abuse-prevention: a lightweight rate-limit ledger for public,
-- unauthenticated Server Actions (contact form, newsletter signup). Writes go
-- only through the service_role admin client; clients have no access (RLS on,
-- no policy = default-deny).
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_created
  ON public.rate_limits (key, created_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only service_role (RLS-bypassing) may read/write.
