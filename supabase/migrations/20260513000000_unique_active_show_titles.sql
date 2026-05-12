create unique index if not exists idx_shows_active_title_unique
on public.shows ((lower(btrim(title))))
where archived = false;
