-- Optional cover image URL for category (browse rails / admin thumb). Do not overload `icon` (viewer uses icon as text eyebrow).
alter table public.categories
  add column if not exists cover_url text;

comment on column public.categories.cover_url is 'Optional image URL for category artwork in admin and optional viewer chrome.';
