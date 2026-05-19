alter table public.shows
  add column if not exists sort_order integer;

with ordered_shows as (
  select
    id,
    row_number() over (order by created_at desc, id) - 1 as next_sort_order
  from public.shows
  where sort_order is null
)
update public.shows
set sort_order = ordered_shows.next_sort_order
from ordered_shows
where shows.id = ordered_shows.id;

alter table public.shows
  alter column sort_order set default 0,
  alter column sort_order set not null;

create index if not exists idx_shows_active_sort_order
  on public.shows (archived, sort_order, created_at desc);
