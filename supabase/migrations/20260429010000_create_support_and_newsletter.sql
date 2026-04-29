create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'responded', 'closed')),
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'failed')),
  notification_error text,
  responded_at timestamptz,
  responded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_messages enable row level security;

create trigger set_updated_at before update on public.support_messages
  for each row execute procedure public.update_updated_at();

create policy "Admin can view support messages"
  on public.support_messages for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admin can update support messages"
  on public.support_messages for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create index idx_support_messages_created_at
  on public.support_messages(created_at desc);

create index idx_support_messages_status
  on public.support_messages(status);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  normalized_email text not null,
  source text not null default 'footer',
  status text not null default 'active'
    check (status in ('active', 'paused', 'unsubscribed')),
  interests jsonb not null default '[]'::jsonb,
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'failed')),
  notification_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_email)
);

alter table public.newsletter_subscribers enable row level security;

create trigger set_updated_at before update on public.newsletter_subscribers
  for each row execute procedure public.update_updated_at();

create policy "Admin can view newsletter subscribers"
  on public.newsletter_subscribers for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admin can update newsletter subscribers"
  on public.newsletter_subscribers for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create index idx_newsletter_subscribers_created_at
  on public.newsletter_subscribers(created_at desc);

create index idx_newsletter_subscribers_status
  on public.newsletter_subscribers(status);
