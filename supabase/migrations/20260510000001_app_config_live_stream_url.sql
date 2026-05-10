-- Admin-configurable live stream link (e.g. YouTube); navbar falls back to /watch#now-streaming when null.
alter table public.app_config
  add column if not exists live_stream_url text;

comment on column public.app_config.live_stream_url is 'Optional external live stream URL (typically YouTube). When set, Now Live nav uses this with target=_blank.';
