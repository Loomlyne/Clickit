-- Add featured column to shows for hero banner selection
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
