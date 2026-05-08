-- Keep existing projects aligned with the MP4 upload contract.
-- The original bucket migration used ON CONFLICT DO NOTHING, so projects where
-- site-assets already existed could keep stale limits or MIME settings.
update storage.buckets
set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'video/mp4',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/x-icon',
    'image/svg+xml'
  ]
where id = 'site-assets';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  52428800,
  array[
    'video/mp4',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/x-icon',
    'image/svg+xml'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
