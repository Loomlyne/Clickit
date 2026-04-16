-- Add hero video fields to app_config
ALTER TABLE public.app_config
  ADD COLUMN hero_video_url TEXT,
  ADD COLUMN hero_video_type TEXT CHECK (hero_video_type IN ('mp4', 'youtube'));

-- Create site-assets storage bucket for video uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-assets',
  'site-assets',
  true,
  52428800, -- 50 MB
  ARRAY['video/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read site-assets (public bucket)
CREATE POLICY "Public read site-assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'site-assets');

-- RLS: only admin can upload/update/delete site-assets
CREATE POLICY "Admin manage site-assets"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'site-assets'
    AND auth.uid() = (SELECT admin_user_id FROM public.app_config WHERE id = 1)
  )
  WITH CHECK (
    bucket_id = 'site-assets'
    AND auth.uid() = (SELECT admin_user_id FROM public.app_config WHERE id = 1)
  );
