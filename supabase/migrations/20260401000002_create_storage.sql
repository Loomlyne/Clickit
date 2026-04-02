-- ============================================================
-- CIT Platform Storage Setup
-- Phase 6: Backend Foundation
-- ============================================================
-- Creates public bucket for show artwork with admin-only upload.
-- Path convention: shows/{show_id}/poster.webp, hero.webp, logo.png
-- ============================================================

-- Cleanup: remove pre-existing storage policies
drop policy if exists "Admin can upload artwork" on storage.objects;
drop policy if exists "Admin can update artwork" on storage.objects;
drop policy if exists "Admin can delete artwork" on storage.objects;

-- Create public bucket for show artwork (D-16, D-17)
-- ON CONFLICT handles case where bucket already exists from prior setup
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'show-artwork',
  'show-artwork',
  true,
  5242880,  -- 5MB limit
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Admin can upload artwork (D-18)
create policy "Admin can upload artwork"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'show-artwork'
    and (select public.is_admin())
  );

-- Admin can update artwork
create policy "Admin can update artwork"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'show-artwork'
    and (select public.is_admin())
  );

-- Admin can delete artwork
create policy "Admin can delete artwork"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'show-artwork'
    and (select public.is_admin())
  );
