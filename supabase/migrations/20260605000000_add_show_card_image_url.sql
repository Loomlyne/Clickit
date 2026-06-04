-- Dedicated 16:9 landscape card image for shows, separate from the hero slider.
--
-- The browse/rail ShowCard previously reused hero_url, which coupled the
-- landscape card to the hero slider media: uploading a desktop hero changed both
-- the hero banner and every rail card. This column lets admins set the card
-- image independently. Cards fall back to hero_url when this is null, so existing
-- shows keep rendering exactly as before until a card image is uploaded.
--
-- Additive + nullable: safe to apply without downtime.
alter table public.shows
  add column if not exists card_image_url text;

comment on column public.shows.card_image_url is
  '16:9 landscape image shown in content rails / browse cards. Independent of the hero slider. Falls back to hero_url when null.';
