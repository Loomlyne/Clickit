-- ============================================================
-- Phase 5 M1b: email outbox, digest ledger and their RPCs (expand-only)
--
-- Second half of the additive M1 step (D-40). M1a (20261021142458) added the
-- account columns, public.admins and episodes.live_at. Both are applied on
-- live together, through apply-live-migrations.yml with Koss's approval,
-- BEFORE the Phase 5 code deploy. The current production code ignores
-- everything added here.
--
-- Expand-only: three new tables and six new functions. Nothing existing is
-- removed, narrowed or rewritten.
--
-- Decisions: D-28 (outbox + queue), D-29 (sweep), D-30 (welcome claim),
-- D-34 (digest), D-38/D-39 (support and newsletter mail, per-address caps).
-- Research: Pattern 4, F5 (live_at + ledger), F8 (lease, 23 h), Pitfall 7
-- (welcome race, missing profile), Pitfall 8 (Dubai date).
--
-- Access: every table has RLS on with no policies and is reachable only by
-- service_role; every function is SECURITY DEFINER with search_path '' and
-- EXECUTE for service_role only.
--
-- Public repository: no UUIDs, no email addresses, no secrets in this file.
-- ============================================================

-- ------------------------------------------------------------
-- (1) public.email_outbox (D-28)
-- ------------------------------------------------------------
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('welcome', 'digest', 'support_ack', 'support_admin', 'newsletter_confirm')),
  idempotency_key text not null unique
    check (char_length(idempotency_key) between 1 and 300),
  to_user uuid null references auth.users(id) on delete cascade,
  to_email text null,
  reply_to text null,
  locale text not null default 'en' check (locale in ('en', 'ar')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'retrying', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  first_attempt_at timestamptz,
  lease_until timestamptz,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  last_error text check (char_length(last_error) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (to_user is not null or to_email is not null)
);

create index if not exists idx_email_outbox_status_next
  on public.email_outbox (status, next_attempt_at);
create index if not exists idx_email_outbox_status_created
  on public.email_outbox (status, created_at);
create index if not exists idx_email_outbox_kind_email_created
  on public.email_outbox (kind, lower(to_email), created_at);
-- Deleting an auth user cascades here; without this index that is a full scan.
create index if not exists idx_email_outbox_to_user
  on public.email_outbox (to_user)
  where to_user is not null;

create or replace trigger set_updated_at
  before update on public.email_outbox
  for each row execute procedure public.update_updated_at();

alter table public.email_outbox enable row level security;
comment on table public.email_outbox is
  'App email outbox (D-28). RLS on with no policies on purpose: service_role and SECURITY DEFINER RPCs only.';

revoke all on table public.email_outbox from public, anon, authenticated;
grant all on table public.email_outbox to service_role;

-- ------------------------------------------------------------
-- (2) public.notification_sends: digest ledger (F5)
-- ------------------------------------------------------------
-- One row per (viewer, episode, kind) ever announced. build_digest inserts it
-- in the same statement chain as the outbox row, so an episode is never
-- announced twice to the same viewer, whatever the run window.
create table if not exists public.notification_sends (
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  kind text not null default 'digest',
  sent_at timestamptz not null default now(),
  primary key (user_id, episode_id, kind)
);

create index if not exists idx_notification_sends_episode
  on public.notification_sends (episode_id);

alter table public.notification_sends enable row level security;
comment on table public.notification_sends is
  'Digest ledger (F5). RLS on with no policies on purpose: service_role and SECURITY DEFINER RPCs only.';

revoke all on table public.notification_sends from public, anon, authenticated;
grant all on table public.notification_sends to service_role;

-- ------------------------------------------------------------
-- (3) public.digest_runs: digest window (D-34)
-- ------------------------------------------------------------
create table if not exists public.digest_runs (
  id uuid primary key default gen_random_uuid(),
  window_start timestamptz not null,
  window_end timestamptz not null,
  status text not null check (status in ('running', 'success', 'failed')),
  emails integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_digest_runs_status_end
  on public.digest_runs (status, window_end);

alter table public.digest_runs enable row level security;
comment on table public.digest_runs is
  'Digest runs (D-34). RLS on with no policies on purpose: service_role and SECURITY DEFINER RPCs only.';

revoke all on table public.digest_runs from public, anon, authenticated;
grant all on table public.digest_runs to service_role;

-- ------------------------------------------------------------
-- (4) enqueue_email (Pattern 4, D-38, D-39)
-- ------------------------------------------------------------
-- One outbox row per call (or one per public.admins row for p_admin_all),
-- inserted once per idempotency key. Outcome per returned row:
--   queued    : inserted, id is the new row
--   duplicate : the key already exists, nothing inserted, id null
--   capped    : per-address cap reached (support_ack 3 per 24 h,
--               newsletter_confirm 1 per 10 min), nothing inserted, id null
-- p_admin_all with no admins rows returns zero rows and inserts nothing; the
-- caller logs no_recipients (05-16).
create or replace function public.enqueue_email(
  p_kind text,
  p_key text,
  p_to_user uuid default null,
  p_to_email text default null,
  p_admin_all boolean default false,
  p_payload jsonb default '{}'::jsonb,
  p_locale text default 'en',
  p_reply_to text default null
)
returns table (id uuid, outcome text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_email text := nullif(lower(btrim(p_to_email)), '');
  v_reply text := nullif(btrim(regexp_replace(coalesce(p_reply_to, ''), '[\r\n]', '', 'g')), '');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_locale text := coalesce(p_locale, 'en');
  v_admin_all boolean := coalesce(p_admin_all, false);
  v_count integer;
  v_id uuid;
  r record;
begin
  if p_kind is null then
    raise exception 'enqueue_email: kind required';
  end if;
  if p_key is null or btrim(p_key) = '' then
    raise exception 'enqueue_email: idempotency key required';
  end if;
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'enqueue_email: payload must be an object';
  end if;
  if not v_admin_all and p_to_user is null and v_email is null then
    raise exception 'enqueue_email: no recipient';
  end if;
  if v_email is not null and v_email ~ '[[:space:][:cntrl:]<>,;]' then
    raise exception 'enqueue_email: invalid address';
  end if;

  -- Admin fan-out: one row per admins row, key suffixed with the admin id.
  if v_admin_all then
    for r in
      select a.user_id, coalesce(p.locale, 'en') as locale
      from public.admins a
      left join public.profiles p on p.id = a.user_id
      order by a.added_at, a.user_id
    loop
      v_id := null;
      insert into public.email_outbox as o
        (kind, idempotency_key, to_user, reply_to, locale, payload)
      values
        (p_kind, p_key || ':' || r.user_id::text, r.user_id, v_reply, r.locale, v_payload)
      on conflict (idempotency_key) do nothing
      returning o.id into v_id;
      id := v_id;
      outcome := case when v_id is null then 'duplicate' else 'queued' end;
      return next;
    end loop;
    return;
  end if;

  -- Same key again (form resubmitted, action retried): nothing new.
  if exists (select 1 from public.email_outbox o where o.idempotency_key = p_key) then
    id := null;
    outcome := 'duplicate';
    return next;
    return;
  end if;

  -- Per-address caps against mail bombing (D-39). The advisory lock makes two
  -- concurrent calls for the same address count one after the other.
  if p_kind in ('support_ack', 'newsletter_confirm') then
    perform pg_advisory_xact_lock(
      hashtextextended('enqueue_email:' || p_kind || ':' || coalesce(v_email, p_to_user::text), 0)
    );
    select count(*) into v_count
    from public.email_outbox o
    where o.kind = p_kind
      and (
        (v_email is not null and lower(o.to_email) = v_email)
        or (v_email is null and o.to_user = p_to_user)
      )
      and o.created_at > now() - case
        when p_kind = 'support_ack' then interval '24 hours'
        else interval '10 minutes'
      end;
    if (p_kind = 'support_ack' and v_count >= 3)
       or (p_kind = 'newsletter_confirm' and v_count >= 1) then
      id := null;
      outcome := 'capped';
      return next;
      return;
    end if;
  end if;

  v_id := null;
  insert into public.email_outbox as o
    (kind, idempotency_key, to_user, to_email, reply_to, locale, payload)
  values
    (p_kind, p_key, p_to_user, v_email, v_reply, v_locale, v_payload)
  on conflict (idempotency_key) do nothing
  returning o.id into v_id;
  id := v_id;
  outcome := case when v_id is null then 'duplicate' else 'queued' end;
  return next;
end;
$$;

revoke all on function public.enqueue_email(text, text, uuid, text, boolean, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.enqueue_email(text, text, uuid, text, boolean, jsonb, text, text)
  to service_role;

-- ------------------------------------------------------------
-- (5) claim_welcome (D-30, Pitfall 7)
-- ------------------------------------------------------------
-- Creates the profile row when it is missing, then claims the welcome with a
-- conditional update: two concurrent callers serialise on the profile row
-- and only the first sees welcome_sent_at null. Returns the new outbox id, or
-- null when the welcome was already claimed (or backfilled by M1a).
create or replace function public.claim_welcome(p_user uuid, p_locale text default 'en')
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_locale text := case when p_locale in ('en', 'ar') then p_locale else 'en' end;
  v_claimed uuid;
  v_id uuid;
begin
  if p_user is null then
    raise exception 'claim_welcome: user required';
  end if;

  insert into public.profiles (id, locale)
  values (p_user, v_locale)
  on conflict (id) do nothing;

  update public.profiles p
  set welcome_sent_at = now()
  where p.id = p_user
    and p.welcome_sent_at is null
  returning p.id into v_claimed;

  if v_claimed is null then
    return null;
  end if;

  insert into public.email_outbox as o (kind, idempotency_key, to_user, locale)
  values ('welcome', 'welcome:' || p_user::text, p_user, v_locale)
  on conflict (idempotency_key) do nothing
  returning o.id into v_id;

  return v_id;
end;
$$;

revoke all on function public.claim_welcome(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_welcome(uuid, text) to service_role;

-- ------------------------------------------------------------
-- (6) claim_outbox (Pattern 4, F8; row shape = 05-08 ClaimedRow)
-- ------------------------------------------------------------
-- Leases the given rows for 5 minutes: pending or retrying with a free lease,
-- or sending whose lease expired (a consumer crashed). attempts + 1;
-- first_attempt_at is set once. For user rows the address is the auth email
-- only when it is confirmed (else null, and the consumer skips the row); the
-- locale is the recipient's profile locale, falling back to the row's.
create or replace function public.claim_outbox(p_ids uuid[])
returns table (
  id uuid,
  kind text,
  idempotency_key text,
  to_user uuid,
  to_address text,
  reply_to text,
  locale text,
  payload jsonb,
  attempts integer,
  first_attempt_at timestamptz
)
language sql
volatile
security definer
set search_path = ''
as $$
  with claimed as (
    update public.email_outbox o
    set
      status = 'sending',
      attempts = o.attempts + 1,
      first_attempt_at = coalesce(o.first_attempt_at, now()),
      lease_until = now() + interval '5 minutes'
    where o.id = any(p_ids)
      and (
        (o.status in ('pending', 'retrying') and (o.lease_until is null or o.lease_until < now()))
        or (o.status = 'sending' and o.lease_until < now())
      )
    returning o.id, o.kind, o.idempotency_key, o.to_user, o.to_email, o.reply_to,
      o.locale, o.payload, o.attempts, o.first_attempt_at
  )
  select
    c.id,
    c.kind,
    c.idempotency_key,
    c.to_user,
    case
      when c.to_user is not null then
        case when u.email_confirmed_at is not null then nullif(u.email::text, '') end
      else c.to_email
    end as to_address,
    c.reply_to,
    coalesce(p.locale, c.locale) as locale,
    c.payload,
    c.attempts,
    c.first_attempt_at
  from claimed c
  left join auth.users u on u.id = c.to_user
  left join public.profiles p on p.id = c.to_user
$$;

revoke all on function public.claim_outbox(uuid[]) from public, anon, authenticated;
grant execute on function public.claim_outbox(uuid[]) to service_role;

-- ------------------------------------------------------------
-- (7) finish_outbox (Pattern 4; entry shape = 05-08 FinishEntry)
-- ------------------------------------------------------------
-- p_results: [{ id, status, provider_id?, error?, next_attempt_at? }]. Only
-- rows still 'sending' change; status must be sent, retrying, failed or
-- skipped. error is a fixed reason string, stored cut to 200 characters.
-- Finished support_admin rows are mirrored into
-- support_messages.notification_status by payload.message_id: any sent copy
-- makes it 'sent'; failed or skipped copies make it 'failed' unless a copy was
-- already sent. Returns the number of outbox rows updated.
create or replace function public.finish_outbox(p_results jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  if p_results is null or jsonb_typeof(p_results) = 'null' then
    return 0;
  end if;
  if jsonb_typeof(p_results) <> 'array' then
    raise exception 'finish_outbox: results must be an array';
  end if;

  with entries as (
    select distinct on (x.id)
      x.id, x.status, x.provider_id, x.error, x.next_attempt_at
    from jsonb_to_recordset(p_results)
      as x(id uuid, status text, provider_id text, error text, next_attempt_at timestamptz)
    where x.id is not null
      and x.status in ('sent', 'retrying', 'failed', 'skipped')
    order by x.id
  ),
  done as (
    update public.email_outbox o
    set
      status = e.status,
      lease_until = null,
      sent_at = case when e.status = 'sent' then now() else o.sent_at end,
      provider_id = case when e.status = 'sent' then e.provider_id else o.provider_id end,
      next_attempt_at = case
        when e.status = 'retrying' then coalesce(e.next_attempt_at, now())
        else null
      end,
      last_error = left(e.error, 200)
    from entries e
    where o.id = e.id
      and o.status = 'sending'
    returning o.id, o.kind, o.status, o.payload, o.last_error
  ),
  mirror as (
    select
      (d.payload->>'message_id')::uuid as message_id,
      bool_or(d.status = 'sent') as any_sent,
      max(d.last_error) filter (where d.status in ('failed', 'skipped')) as last_error
    from done d
    where d.kind = 'support_admin'
      and d.status in ('sent', 'failed', 'skipped')
      and (d.payload->>'message_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    group by 1
  ),
  mirrored as (
    update public.support_messages s
    set
      notification_status = case
        when m.any_sent or s.notification_status = 'sent' then 'sent'
        else 'failed'
      end,
      notification_error = case
        when m.any_sent or s.notification_status = 'sent' then null
        else coalesce(m.last_error, 'failed')
      end
    from mirror m
    where s.id = m.message_id
    returning s.id
  )
  select count(*) into v_count from done;

  return v_count;
end;
$$;

revoke all on function public.finish_outbox(jsonb) from public, anon, authenticated;
grant execute on function public.finish_outbox(jsonb) to service_role;

-- ------------------------------------------------------------
-- (8) sweep_outbox (D-29, F8)
-- ------------------------------------------------------------
-- First fails rows whose first attempt is older than 23 h (Resend keeps an
-- idempotency key for 24 h, so a later send could be a duplicate: a human
-- decides). Then returns, oldest first, the rows to put back on the queue:
-- pending for more than 15 minutes, retrying past next_attempt_at, and
-- sending whose lease expired (a consumer crashed and the message was lost).
create or replace function public.sweep_outbox(p_limit integer default 100)
returns setof uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.email_outbox o
  set status = 'failed', last_error = 'stale_over_23h', lease_until = null
  where o.first_attempt_at < now() - interval '23 hours'
    and (
      o.status in ('pending', 'retrying')
      or (o.status = 'sending' and o.lease_until < now())
    );

  return query
    select o.id
    from public.email_outbox o
    where (
        (o.status = 'pending' and o.created_at < now() - interval '15 minutes')
        or (o.status = 'retrying' and coalesce(o.next_attempt_at, '-infinity'::timestamptz) <= now())
        or (o.status = 'sending' and o.lease_until < now())
      )
      and (o.lease_until is null or o.lease_until < now())
    order by o.created_at, o.id
    limit greatest(1, least(coalesce(p_limit, 100), 1000));
end;
$$;

revoke all on function public.sweep_outbox(integer) from public, anon, authenticated;
grant execute on function public.sweep_outbox(integer) to service_role;

-- ------------------------------------------------------------
-- (9) build_digest (D-34, F5, Pitfall 8)
-- ------------------------------------------------------------
-- One digest row per viewer per Dubai date, listing episodes that went live
-- in the window on shows in the viewer's My List, for viewers with
-- notify_new_episodes on and a confirmed email. The window starts at the end
-- of the last successful run (24 h back when there is none) and ends at
-- p_now; an episode is announced at most once per viewer (ledger). A second
-- call on the same Dubai date does nothing. A failed run is marked 'failed'
-- and the error re-raised, so it never moves the window. Returns the new
-- outbox ids (the caller queues them).
create or replace function public.build_digest(p_now timestamptz default now())
returns setof uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_date date := (coalesce(p_now, now()) at time zone 'Asia/Dubai')::date;
  v_lower timestamptz;
  v_run uuid;
  v_ids uuid[];
begin
  -- Cron delivery may repeat: concurrent calls run one after the other.
  perform pg_advisory_xact_lock(hashtextextended('public.build_digest', 0));

  if exists (
    select 1
    from public.digest_runs r
    where r.status = 'success'
      and (r.window_end at time zone 'Asia/Dubai')::date = v_date
  ) then
    return;
  end if;

  v_lower := coalesce(
    (select max(window_end) from public.digest_runs r where r.status = 'success'),
    v_now - interval '24 hours'
  );
  if v_lower >= v_now then
    return;
  end if;

  insert into public.digest_runs as r (window_start, window_end, status)
  values (v_lower, v_now, 'running')
  returning r.id into v_run;

  begin
    with cand as (
      select
        w.user_id,
        coalesce(p.locale, 'en') as locale,
        s.id as show_id,
        s.title as show_title,
        s.title_ar as show_title_ar,
        s.slug,
        coalesce(nullif(btrim(s.card_image_url), ''), nullif(btrim(s.hero_url), '')) as image_url,
        e.id as episode_id,
        e.live_at,
        se.season_number,
        e.episode_number,
        e.title as episode_title,
        e.title_ar as episode_title_ar
      from public.episodes e
      join public.shows s on s.id = e.show_id
      join public.seasons se on se.id = e.season_id
      join public.watchlist w on w.show_id = s.id
      join public.profiles p on p.id = w.user_id
      join auth.users u on u.id = w.user_id
      where e.live_at > v_lower
        and e.live_at <= v_now
        and e.archived = false
        and (
          e.status = 'published'
          or (e.status = 'coming-soon' and e.publish_at is not null and e.publish_at <= v_now)
        )
        and s.archived = false
        and s.status in ('now-streaming', 'coming-soon')
        and p.notify_new_episodes
        and u.email_confirmed_at is not null
        and u.deleted_at is null
        and not exists (
          select 1
          from public.notification_sends ns
          where ns.user_id = w.user_id
            and ns.episode_id = e.id
            and ns.kind = 'digest'
        )
    ),
    per_show as (
      select
        c.user_id,
        c.locale,
        c.show_id,
        max(c.live_at) as newest,
        jsonb_build_object(
          'title', c.show_title,
          'title_ar', c.show_title_ar,
          'slug', c.slug,
          'image_url', c.image_url,
          'episodes', jsonb_agg(
            jsonb_build_object(
              'id', c.episode_id,
              'season_number', c.season_number,
              'episode_number', c.episode_number,
              'title', c.episode_title,
              'title_ar', c.episode_title_ar
            )
            order by c.season_number, c.episode_number, c.episode_id
          )
        ) as show_json
      from cand c
      group by c.user_id, c.locale, c.show_id, c.show_title, c.show_title_ar, c.slug, c.image_url
    ),
    per_user as (
      select
        ps.user_id,
        ps.locale,
        jsonb_build_object(
          'shows', jsonb_agg(ps.show_json order by ps.newest desc, ps.show_id),
          'total_shows', count(*)
        ) as payload
      from per_show ps
      group by ps.user_id, ps.locale
    ),
    ins as (
      insert into public.email_outbox as o (kind, idempotency_key, to_user, locale, payload)
      select
        'digest',
        'digest:' || pu.user_id::text || ':' || to_char(v_date, 'YYYY-MM-DD'),
        pu.user_id,
        pu.locale,
        pu.payload
      from per_user pu
      on conflict (idempotency_key) do nothing
      returning o.id, o.to_user
    ),
    ledger as (
      insert into public.notification_sends (user_id, episode_id, kind)
      select distinct c.user_id, c.episode_id, 'digest'
      from cand c
      join ins i on i.to_user = c.user_id
      on conflict do nothing
      returning 1
    )
    select coalesce(array_agg(i.id), '{}'::uuid[]) into v_ids
    from ins i;

    update public.digest_runs r
    set status = 'success', emails = coalesce(cardinality(v_ids), 0)
    where r.id = v_run;
  exception when others then
    update public.digest_runs r set status = 'failed' where r.id = v_run;
    raise;
  end;

  return query select unnest(v_ids);
end;
$$;

revoke all on function public.build_digest(timestamptz) from public, anon, authenticated;
grant execute on function public.build_digest(timestamptz) to service_role;
