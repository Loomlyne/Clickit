-- Drop unused category cover URL (was used only by admin list/editor).
alter table public.categories
  drop column if exists cover_url;

