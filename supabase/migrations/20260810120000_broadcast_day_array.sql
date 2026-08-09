-- ============================================================
-- Allow shows to air on multiple broadcast days.
-- broadcast_day was a single text value (e.g. 'Sunday'); convert it to
-- text[] so the admin can select multiple days (e.g. {Monday,Wednesday}).
-- Existing single values are preserved as one-element arrays.
-- ============================================================
alter table public.shows
  alter column broadcast_day type text[]
  using case
    when broadcast_day is null then null
    else array[broadcast_day]
  end;

comment on column public.shows.broadcast_day is 'D-05: weekday names the show airs on, e.g. {Monday,Wednesday,Friday}';
