-- Top news ticker (viewer chrome) — admin-editable via app_config.top_ticker
alter table public.app_config
  add column if not exists top_ticker jsonb not null default jsonb_build_object(
    'enabled', true,
    'items', jsonb_build_array(
      jsonb_build_object('tag', 'NEW', 'text', 'Original shows · premiering now'),
      jsonb_build_object('tag', 'LIVE', 'text', 'Streaming from Abu Dhabi'),
      jsonb_build_object('tag', 'SHORT', 'text', 'Quick bites · 90-second cuts'),
      jsonb_build_object('tag', 'EST 2026', 'text', 'Clickit · Hand-picked, no algorithm')
    )
  );

alter table public.app_config
  add constraint app_config_top_ticker_shape check (
    jsonb_typeof(top_ticker -> 'enabled') = 'boolean'
    and jsonb_typeof(top_ticker -> 'items') = 'array'
  );
