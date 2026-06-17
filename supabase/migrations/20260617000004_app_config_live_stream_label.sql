-- Admin-configurable navbar "Now Live" label (EN + optional AR).
alter table public.app_config
  add column if not exists live_stream_label text,
  add column if not exists live_stream_label_ar text;

comment on column public.app_config.live_stream_label is 'Custom EN label for the red Now Live nav pill. Null falls back to i18n default.';
comment on column public.app_config.live_stream_label_ar is 'Custom AR label for the Now Live nav pill. Null falls back to EN or i18n default.';
