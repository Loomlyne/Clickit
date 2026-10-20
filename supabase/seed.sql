-- ============================================================
-- Local development seed data (Phase 1 SAFE-01, 2026-10-20)
-- ============================================================
-- Fake shows, seasons, episodes, shorts and cast, moved here out of
-- supabase/migrations so no migration can ever insert fake data into
-- a real database.
--
-- Loaded only by `supabase db reset --local`, because
-- [db.seed] enabled = true in supabase/config.toml.
-- NEVER run against live. Neither GitHub workflow passes the
-- include-seed flag. The guard below refuses to run if public.shows
-- already has rows.
-- ============================================================

do $$
begin
  if exists (select 1 from public.shows) then
    raise exception 'seed.sql refuses to run: public.shows is not empty (never seed a real database)';
  end if;
end $$;

-- ------------------------------------------------------------
-- Shows, seasons, episodes (was 20260401000003_seed_data.sql)
-- broadcast_day is text[] since 20260810120000
-- ------------------------------------------------------------
DO $$
DECLARE
  -- Show UUIDs
  show_last_call uuid;
  show_review_doc uuid;
  show_doctor_care uuid;
  show_saturn_podcast uuid;
  show_poets_platform uuid;
  show_kids_area uuid;
  show_infocus uuid;
  show_breakfast_daily uuid;
  show_meta_talk uuid;
  show_360 uuid;
  show_music_hub uuid;
  show_laugh_or_leave uuid;
  show_island_cooke uuid;
  show_60_questions uuid;
  show_nexthub uuid;
  -- Reusable season ID variable
  season_id uuid;
BEGIN

  -- ============================================================
  -- SHOW 1: Last Call (from mock data)
  -- Entertainment, brand-purple, Sunday 10:00 PM
  -- 2 seasons, 10 episodes total (5+5)
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('Last Call', 'last-call', 'Every night has a story', 'Follow host Khalid as he roams the streets of Abu Dhabi after midnight, turning chance encounters into unforgettable conversations. From taxi drivers to CEOs, every night has a story waiting to be told.', 'Entertainment', 'now-streaming', 'brand-purple', '{Sunday}', '22:00:00', 10, 2)
  RETURNING id INTO show_last_call;

  -- Season 1 (5 episodes)
  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_last_call, 1, 'Season 1', 5)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_last_call, season_id, 1, 'Late Night in Abu Dhabi', 'Street interviews after midnight in the capital city.', 25, 'published', 'dQw4w9WgXcQ'),
    (show_last_call, season_id, 2, 'The Corniche Confessions', 'People share their deepest thoughts along the waterfront.', 22, 'published', 'jNQXAC9IVRw'),
    (show_last_call, season_id, 3, 'Desert Voices', 'Stories from travellers passing through the Al Dhafra region.', 28, 'published', '9bZkp7q19f0'),
    (show_last_call, season_id, 4, 'Market After Dark', 'Exploring the vibrant night markets of Abu Dhabi.', 24, 'published', 'dQw4w9WgXcQ'),
    (show_last_call, season_id, 5, 'Island Nights', 'Late-night adventures on Yas Island with locals and tourists.', 26, 'published', 'jNQXAC9IVRw');

  -- Season 2 (5 episodes)
  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_last_call, 2, 'Season 2', 5)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_last_call, season_id, 1, 'Return to the Streets', 'Season two kicks off with a fresh round of street encounters.', 25, 'published', '9bZkp7q19f0'),
    (show_last_call, season_id, 2, 'Festival Frenzy', 'Capturing the energy of Abu Dhabi festival season.', 23, 'published', 'dQw4w9WgXcQ'),
    (show_last_call, season_id, 3, 'The Last Bus Home', 'Stories from the final bus routes of the evening.', 27, 'published', 'jNQXAC9IVRw'),
    (show_last_call, season_id, 4, 'Midnight Majlis', 'A special gathering under the stars with surprise guests.', 30, 'coming-soon', NULL),
    (show_last_call, season_id, 5, 'Season Finale: One More Call', 'The most memorable moments from season two.', 35, 'draft', NULL);

  -- ============================================================
  -- SHOW 2: Review Documentary (from mock data)
  -- Documentary, brand-blue, Saturday 8:00 PM
  -- 1 season, 6 episodes
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('Review Documentary', 'review-documentary', 'Stories that shape our world', 'An award-winning documentary series that travels across the Gulf region to uncover stories that shaped civilizations. From ancient trade routes to modern megacities, each episode reveals a chapter you never knew existed.', 'Documentary', 'now-streaming', 'brand-blue', '{Saturday}', '20:00:00', 6, 1)
  RETURNING id INTO show_review_doc;

  -- Season 1 (6 episodes)
  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_review_doc, 1, 'Season 1', 6)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_review_doc, season_id, 1, 'The Forgotten Oasis', 'An ancient oasis reveals centuries of hidden history.', 42, 'published', '9bZkp7q19f0'),
    (show_review_doc, season_id, 2, 'Pearl Divers of the Gulf', 'Following the last generation of traditional pearl divers.', 38, 'published', 'dQw4w9WgXcQ'),
    (show_review_doc, season_id, 3, 'Silk Roads Reimagined', 'Tracing modern trade routes that echo the ancient Silk Road.', 45, 'published', 'jNQXAC9IVRw'),
    (show_review_doc, season_id, 4, 'Guardians of the Mangroves', 'Conservation efforts saving Abu Dhabi''s coastal ecosystems.', 40, 'published', '9bZkp7q19f0'),
    (show_review_doc, season_id, 5, 'Voices of the Desert', 'Bedouin communities share their stories of adaptation.', 44, 'published', 'dQw4w9WgXcQ'),
    (show_review_doc, season_id, 6, 'The Future Heritage', 'How the UAE preserves its past while building the future.', 42, 'coming-soon', NULL);

  -- ============================================================
  -- SHOW 3: Doctor Care (from mock data)
  -- Health, brand-green, Thursday 9:00 PM
  -- 2 seasons, 8 episodes total (4+4)
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('Doctor Care', 'doctor-care', 'Your health, simplified', 'Leading physicians and wellness experts break down complex health topics into practical advice you can use today. From nutrition myths to mental health breakthroughs, Doctor Care puts your wellbeing first.', 'Health', 'now-streaming', 'brand-green', '{Thursday}', '21:00:00', 8, 2)
  RETURNING id INTO show_doctor_care;

  -- Season 1 (4 episodes)
  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_doctor_care, 1, 'Season 1', 4)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_doctor_care, season_id, 1, 'Heart Health 101', 'Understanding cardiovascular health with leading cardiologists.', 45, 'published', 'jNQXAC9IVRw'),
    (show_doctor_care, season_id, 2, 'Sleep Science', 'Why quality sleep is the foundation of good health.', 40, 'published', '9bZkp7q19f0'),
    (show_doctor_care, season_id, 3, 'Nutrition Myths Debunked', 'Separating fact from fiction in everyday nutrition.', 42, 'published', 'dQw4w9WgXcQ'),
    (show_doctor_care, season_id, 4, 'Mental Wellness in the Gulf', 'Breaking stigma around mental health in the region.', 50, 'published', 'jNQXAC9IVRw');

  -- Season 2 (4 episodes)
  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_doctor_care, 2, 'Season 2', 4)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_doctor_care, season_id, 1, 'Children''s Health Guide', 'A comprehensive look at paediatric wellness.', 44, 'published', '9bZkp7q19f0'),
    (show_doctor_care, season_id, 2, 'Fitness for Every Age', 'Exercise plans tailored for different life stages.', 38, 'published', 'dQw4w9WgXcQ'),
    (show_doctor_care, season_id, 3, 'The Hydration Episode', 'Why staying hydrated matters more in desert climates.', 35, 'coming-soon', NULL),
    (show_doctor_care, season_id, 4, 'Preventive Medicine', 'Early detection and screening programmes in the UAE.', 48, 'draft', NULL);

  -- ============================================================
  -- SHOW 4: Saturn Podcast (from mock data)
  -- Tech, brand-orange, Tuesday 8:00 PM
  -- 3 seasons, 15 episodes total (5+5+5)
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('Saturn Podcast', 'saturn-podcast', 'Conversations beyond orbit', 'Deep-dive conversations with the pioneers shaping the UAE tech scene. From AI startups to space ventures, Saturn Podcast takes you inside the minds of the region''s most ambitious innovators.', 'Tech', 'now-streaming', 'brand-orange', '{Tuesday}', '20:00:00', 15, 3)
  RETURNING id INTO show_saturn_podcast;

  -- Season 1 (5 episodes)
  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_saturn_podcast, 1, 'Season 1', 5)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_saturn_podcast, season_id, 1, 'The AI Revolution', 'How artificial intelligence is reshaping life in the Gulf.', 25, 'published', 'jNQXAC9IVRw'),
    (show_saturn_podcast, season_id, 2, 'Space Dreams', 'The UAE''s ambitious plans for Mars and beyond.', 28, 'published', '9bZkp7q19f0'),
    (show_saturn_podcast, season_id, 3, 'Crypto Culture', 'Cryptocurrency adoption in the Middle East tech scene.', 24, 'published', 'dQw4w9WgXcQ'),
    (show_saturn_podcast, season_id, 4, 'Green Tech Pioneers', 'Startups building sustainable technology solutions.', 26, 'published', 'jNQXAC9IVRw'),
    (show_saturn_podcast, season_id, 5, 'Robotics in Daily Life', 'How robots are entering homes and workplaces across the UAE.', 22, 'published', '9bZkp7q19f0');

  -- Season 2 (5 episodes)
  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_saturn_podcast, 2, 'Season 2', 5)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_saturn_podcast, season_id, 1, 'Metaverse Realities', 'Exploring virtual worlds being built in the region.', 25, 'published', 'dQw4w9WgXcQ'),
    (show_saturn_podcast, season_id, 2, 'Quantum Computing 101', 'A beginner-friendly deep dive into quantum technology.', 30, 'published', 'jNQXAC9IVRw'),
    (show_saturn_podcast, season_id, 3, 'Digital Health Frontiers', 'Wearables, telemedicine, and the future of healthcare tech.', 27, 'published', '9bZkp7q19f0'),
    (show_saturn_podcast, season_id, 4, 'Cybersecurity Essentials', 'Protecting yourself in an increasingly connected world.', 24, 'published', 'dQw4w9WgXcQ'),
    (show_saturn_podcast, season_id, 5, 'The Drone Economy', 'Commercial drone applications transforming industries.', 26, 'coming-soon', NULL);

  -- Season 3 (5 episodes)
  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_saturn_podcast, 3, 'Season 3', 5)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_saturn_podcast, season_id, 1, 'Neural Interfaces', 'Brain-computer interfaces and what they mean for humanity.', 28, 'published', 'jNQXAC9IVRw'),
    (show_saturn_podcast, season_id, 2, 'Fusion Energy Update', 'The latest breakthroughs in nuclear fusion research.', 25, 'published', '9bZkp7q19f0'),
    (show_saturn_podcast, season_id, 3, 'Smart Cities of 2030', 'How UAE cities are becoming fully connected ecosystems.', 30, 'published', 'dQw4w9WgXcQ'),
    (show_saturn_podcast, season_id, 4, 'Biotech Breakthroughs', 'Gene editing and personalised medicine in the Gulf.', 27, 'coming-soon', NULL),
    (show_saturn_podcast, season_id, 5, 'The Singularity Debate', 'Will machines ever surpass human intelligence?', 32, 'draft', NULL);

  -- ============================================================
  -- SHOW 5: Poets Platform (from mock data)
  -- Poetry, brand-red, status: coming-soon
  -- 1 season, 4 episodes
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('Poets Platform', 'poets-platform', 'Words that move mountains', 'The most electrifying Arabic poetry competition on screen. Emerging and established poets from across the Arab world take the stage to perform original works that celebrate language, identity, and the human spirit.', 'Poetry', 'coming-soon', 'brand-red', NULL, NULL, 4, 1)
  RETURNING id INTO show_poets_platform;

  -- Season 1 (4 episodes)
  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_poets_platform, 1, 'Season 1', 4)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_poets_platform, season_id, 1, 'Voices of the Dunes', 'Opening night featuring celebrated Emirati poets.', 80, 'coming-soon', NULL),
    (show_poets_platform, season_id, 2, 'Verses in the Wind', 'Poetry performances inspired by Gulf nature and heritage.', 75, 'coming-soon', NULL),
    (show_poets_platform, season_id, 3, 'The Modern Qasida', 'Contemporary poets reimagine classical Arabic forms.', 78, 'coming-soon', NULL),
    (show_poets_platform, season_id, 4, 'Grand Finale Gala', 'The season culminates in a grand celebration of Arabic verse.', 80, 'draft', NULL);

  -- ============================================================
  -- SHOW 6: Kids Area (new)
  -- Kids, brand-green, Friday 4:00 PM
  -- 1 season, 4 episodes
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('Kids Area', 'kids-area', 'Where young stars shine', 'A vibrant talent show for children across the UAE. Young performers showcase singing, dancing, comedy, and more in a fun, supportive environment that celebrates creativity and confidence.', 'Kids', 'now-streaming', 'brand-green', '{Friday}', '16:00:00', 4, 1)
  RETURNING id INTO show_kids_area;

  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_kids_area, 1, 'Season 1', 4)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_kids_area, season_id, 1, 'Talent Spotlight', 'The first round of young performers takes the stage.', 35, 'published', 'dQw4w9WgXcQ'),
    (show_kids_area, season_id, 2, 'Dance and Dream', 'Young dancers share their passion and stories.', 35, 'published', 'jNQXAC9IVRw'),
    (show_kids_area, season_id, 3, 'Comedy Kids', 'Aspiring young comedians try their best material.', 30, 'published', '9bZkp7q19f0'),
    (show_kids_area, season_id, 4, 'Grand Finale', 'The best performers return for a spectacular finale.', 40, 'coming-soon', NULL);

  -- ============================================================
  -- SHOW 7: InFocus (new)
  -- Cinema, brand-blue, Sunday 7:00 PM
  -- 1 season, 4 episodes
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('InFocus', 'infocus', 'Behind every frame, a story', 'Go behind the scenes of Arab cinema with exclusive access to filmmakers, actors, and crews. InFocus reveals the craft, passion, and vision behind the region''s most compelling films and series.', 'Cinema', 'now-streaming', 'brand-blue', '{Sunday}', '19:00:00', 4, 1)
  RETURNING id INTO show_infocus;

  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_infocus, 1, 'Season 1', 4)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_infocus, season_id, 1, 'The Director''s Vision', 'A celebrated UAE filmmaker shares the story behind their latest work.', 80, 'published', '9bZkp7q19f0'),
    (show_infocus, season_id, 2, 'On Set in Abu Dhabi', 'An exclusive look at a major production filming in the capital.', 75, 'published', 'dQw4w9WgXcQ'),
    (show_infocus, season_id, 3, 'The Art of Screenwriting', 'Arab screenwriters discuss storytelling for the big screen.', 70, 'published', 'jNQXAC9IVRw'),
    (show_infocus, season_id, 4, 'Festival Circuit', 'Following a film from production to international festival premiere.', 80, 'coming-soon', NULL);

  -- ============================================================
  -- SHOW 8: Break Fast Daily (new)
  -- Morning Show, brand-orange, Mon-Fri 11:00 AM
  -- 2 seasons, 5 episodes each
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('Break Fast Daily', 'break-fast-daily', 'Start your day inspired', 'The UAE''s favourite morning show brings you daily conversations about culture, lifestyle, food, and community. From celebrity interviews to local heroes, Break Fast Daily is your daily dose of positivity.', 'Morning Show', 'now-streaming', 'brand-orange', '{Monday,Tuesday,Wednesday,Thursday,Friday}', '11:00:00', 10, 2)
  RETURNING id INTO show_breakfast_daily;

  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_breakfast_daily, 1, 'Season 1', 5)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_breakfast_daily, season_id, 1, 'Welcome to the Morning', 'The premiere episode sets the tone for daily inspiration.', 60, 'published', 'jNQXAC9IVRw'),
    (show_breakfast_daily, season_id, 2, 'Local Heroes', 'Spotlighting everyday people making a difference in the UAE.', 55, 'published', '9bZkp7q19f0'),
    (show_breakfast_daily, season_id, 3, 'Kitchen Takeover', 'A chef prepares a live breakfast while sharing life stories.', 60, 'published', 'dQw4w9WgXcQ'),
    (show_breakfast_daily, season_id, 4, 'Wellness Wednesday', 'Tips for mental and physical health to kickstart your week.', 50, 'published', 'jNQXAC9IVRw'),
    (show_breakfast_daily, season_id, 5, 'Weekend Preview', 'The best events and activities happening across the UAE.', 45, 'published', '9bZkp7q19f0');

  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_breakfast_daily, 2, 'Season 2', 5)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_breakfast_daily, season_id, 1, 'New Season, New Energy', 'Season two opens with an exciting new studio reveal.', 60, 'published', 'dQw4w9WgXcQ'),
    (show_breakfast_daily, season_id, 2, 'Street Food Stories', 'Discovering hidden culinary gems across Abu Dhabi.', 55, 'published', 'jNQXAC9IVRw'),
    (show_breakfast_daily, season_id, 3, 'Back to School Special', 'Parents and educators discuss the new academic year.', 50, 'published', '9bZkp7q19f0'),
    (show_breakfast_daily, season_id, 4, 'Festival Season Guide', 'A complete guide to the UAE''s upcoming festivals.', 55, 'coming-soon', NULL),
    (show_breakfast_daily, season_id, 5, 'Year in Review', 'Looking back at the best moments from both seasons.', 60, 'draft', NULL);

  -- ============================================================
  -- SHOW 9: Meta Talk (new)
  -- Tech, brand-purple, Wednesday 9:00 PM
  -- 1 season, 4 episodes
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('Meta Talk', 'meta-talk', 'Reality is just the beginning', 'A cutting-edge talk show exploring virtual reality, augmented reality, and the metaverse. Hosted from a VR studio, Meta Talk interviews the technologists and creators building tomorrow''s digital worlds.', 'Tech', 'now-streaming', 'brand-purple', '{Wednesday}', '21:00:00', 4, 1)
  RETURNING id INTO show_meta_talk;

  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_meta_talk, 1, 'Season 1', 4)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_meta_talk, season_id, 1, 'Welcome to the Metaverse', 'An introduction to virtual worlds and their real-world impact.', 25, 'published', '9bZkp7q19f0'),
    (show_meta_talk, season_id, 2, 'VR in Education', 'How virtual reality is transforming classrooms across the Gulf.', 28, 'published', 'dQw4w9WgXcQ'),
    (show_meta_talk, season_id, 3, 'The Creator Economy', 'Artists and designers building careers in virtual spaces.', 25, 'published', 'jNQXAC9IVRw'),
    (show_meta_talk, season_id, 4, 'Digital Twins and Smart Cities', 'How digital replicas are shaping urban planning in the UAE.', 30, 'coming-soon', NULL);

  -- ============================================================
  -- SHOW 10: 360 (new)
  -- Culture, brand-red, Thursday 7:00 PM
  -- 1 season, 5 episodes
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('360', '360', 'Every angle, every story', 'A cultural spotlight series celebrating Arab creatives from every discipline. From painters to fashion designers, musicians to architects, 360 captures the full spectrum of creative talent in the region.', 'Culture', 'now-streaming', 'brand-red', '{Thursday}', '19:00:00', 5, 1)
  RETURNING id INTO show_360;

  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_360, 1, 'Season 1', 5)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_360, season_id, 1, 'The Calligrapher', 'A master calligrapher blends ancient Arabic script with modern art.', 55, 'published', 'dQw4w9WgXcQ'),
    (show_360, season_id, 2, 'Fashion Forward', 'Emirati fashion designers making waves on the global stage.', 50, 'published', 'jNQXAC9IVRw'),
    (show_360, season_id, 3, 'Sound of the Gulf', 'Musicians fusing traditional Gulf melodies with contemporary beats.', 55, 'published', '9bZkp7q19f0'),
    (show_360, season_id, 4, 'Architecture Reimagined', 'Architects designing the UAE''s most iconic new buildings.', 50, 'published', 'dQw4w9WgXcQ'),
    (show_360, season_id, 5, 'The Storytellers', 'Writers and poets shaping the narrative of modern Arab identity.', 55, 'coming-soon', NULL);

  -- ============================================================
  -- SHOW 11: Music Hub (new)
  -- Music, brand-purple, Friday 9:00 PM
  -- 2 seasons, 4 episodes each
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('Music Hub', 'music-hub', 'Where talent meets the stage', 'A high-energy music talent show featuring emerging artists from across the Arab world. Contestants perform original songs and covers, competing for a recording contract and the title of Music Hub champion.', 'Music', 'now-streaming', 'brand-purple', '{Friday}', '21:00:00', 8, 2)
  RETURNING id INTO show_music_hub;

  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_music_hub, 1, 'Season 1', 4)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_music_hub, season_id, 1, 'Audition Day', 'Hopeful musicians arrive for the first round of auditions.', 50, 'published', 'jNQXAC9IVRw'),
    (show_music_hub, season_id, 2, 'Battle Rounds', 'Contestants go head-to-head in musical duels.', 50, 'published', '9bZkp7q19f0'),
    (show_music_hub, season_id, 3, 'Live Shows Begin', 'The top performers take the live stage for the first time.', 55, 'published', 'dQw4w9WgXcQ'),
    (show_music_hub, season_id, 4, 'Season 1 Finale', 'The grand finale crowns the first Music Hub champion.', 60, 'published', 'jNQXAC9IVRw');

  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_music_hub, 2, 'Season 2', 4)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_music_hub, season_id, 1, 'Fresh Voices', 'A new wave of talent arrives for season two auditions.', 50, 'published', '9bZkp7q19f0'),
    (show_music_hub, season_id, 2, 'Genre Mashup', 'Contestants mix musical genres in creative performances.', 50, 'published', 'dQw4w9WgXcQ'),
    (show_music_hub, season_id, 3, 'Duets Night', 'Performers pair up for unforgettable duet performances.', 55, 'coming-soon', NULL),
    (show_music_hub, season_id, 4, 'Champion Returns', 'Season one''s champion returns as a guest mentor.', 60, 'draft', NULL);

  -- ============================================================
  -- SHOW 12: Laugh or Leave (new)
  -- Comedy, brand-orange, Saturday 10:00 PM
  -- 1 season, 5 episodes
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('Laugh or Leave', 'laugh-or-leave', 'Make them laugh or hit the road', 'A fast-paced comedy competition where amateur comedians have just minutes to win over the audience. If the crowd laughs, you stay. If not, you leave. Simple, brutal, hilarious.', 'Comedy', 'now-streaming', 'brand-orange', '{Saturday}', '22:00:00', 5, 1)
  RETURNING id INTO show_laugh_or_leave;

  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_laugh_or_leave, 1, 'Season 1', 5)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_laugh_or_leave, season_id, 1, 'Open Mic Night', 'The first batch of comedians face the audience.', 15, 'published', 'dQw4w9WgXcQ'),
    (show_laugh_or_leave, season_id, 2, 'Roast Battle', 'Comedians roast each other in hilarious head-to-head matchups.', 15, 'published', 'jNQXAC9IVRw'),
    (show_laugh_or_leave, season_id, 3, 'Improv Chaos', 'Contestants perform improv comedy with audience suggestions.', 15, 'published', '9bZkp7q19f0'),
    (show_laugh_or_leave, season_id, 4, 'Character Comedy', 'Performers bring original characters to life on stage.', 15, 'published', 'dQw4w9WgXcQ'),
    (show_laugh_or_leave, season_id, 5, 'The Last Laugh', 'The funniest performers compete in the grand finale.', 20, 'coming-soon', NULL);

  -- ============================================================
  -- SHOW 13: Island Cooke (new)
  -- Cooking, brand-green, Sunday 5:00 PM
  -- 1 season, 4 episodes
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('Island Cooke', 'island-cooke', 'Flavours from every shore', 'A culinary adventure series where a chef travels to islands across the world, cooking traditional dishes with local ingredients and learning the stories behind each recipe. From the Gulf to the Pacific.', 'Cooking', 'now-streaming', 'brand-green', '{Sunday}', '17:00:00', 4, 1)
  RETURNING id INTO show_island_cooke;

  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_island_cooke, 1, 'Season 1', 4)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_island_cooke, season_id, 1, 'Zanzibar Spice Trail', 'Exploring the spice markets and coastal cuisine of Zanzibar.', 50, 'published', '9bZkp7q19f0'),
    (show_island_cooke, season_id, 2, 'Bahrain Pearl Feast', 'Traditional Bahraini dishes meet modern culinary techniques.', 45, 'published', 'dQw4w9WgXcQ'),
    (show_island_cooke, season_id, 3, 'Sri Lankan Flavours', 'A journey through Sri Lanka''s vibrant food culture.', 50, 'published', 'jNQXAC9IVRw'),
    (show_island_cooke, season_id, 4, 'Yas Island Special', 'Cooking a feast using ingredients sourced entirely from Abu Dhabi.', 55, 'coming-soon', NULL);

  -- ============================================================
  -- SHOW 14: 60 Questions Challenge (new)
  -- Entertainment, brand-red, Wednesday 8:00 PM
  -- 1 season, 4 episodes
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('60 Questions Challenge', '60-questions-challenge', 'Think fast, answer faster', 'An intense quiz show where contestants face 60 rapid-fire questions across science, history, pop culture, and UAE knowledge. Quick thinking and broad knowledge are the keys to winning.', 'Entertainment', 'now-streaming', 'brand-red', '{Wednesday}', '20:00:00', 4, 1)
  RETURNING id INTO show_60_questions;

  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_60_questions, 1, 'Season 1', 4)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_60_questions, season_id, 1, 'The First Challenge', 'Four contestants face off in the inaugural episode.', 80, 'published', 'jNQXAC9IVRw'),
    (show_60_questions, season_id, 2, 'University Special', 'Students from UAE universities compete for bragging rights.', 80, 'published', '9bZkp7q19f0'),
    (show_60_questions, season_id, 3, 'Celebrity Edition', 'Local celebrities take on the 60-question challenge.', 80, 'published', 'dQw4w9WgXcQ'),
    (show_60_questions, season_id, 4, 'Champions Showdown', 'Previous winners return for the ultimate challenge.', 80, 'coming-soon', NULL);

  -- ============================================================
  -- SHOW 15: NextHub (new)
  -- Business, brand-blue, Tuesday 7:00 PM, coming-soon
  -- 1 season, 3 episodes
  -- ============================================================
  INSERT INTO public.shows (title, slug, tagline, description, genre, status, brand_color, broadcast_day, broadcast_time, episode_count, season_count)
  VALUES ('NextHub', 'nexthub', 'The future of business starts here', 'A business-focused series profiling the next generation of entrepreneurs in the Gulf. From pitch competitions to founder interviews, NextHub showcases the startups and innovators shaping the regional economy.', 'Business', 'coming-soon', 'brand-blue', '{Tuesday}', '19:00:00', 3, 1)
  RETURNING id INTO show_nexthub;

  INSERT INTO public.seasons (show_id, season_number, title, episode_count)
  VALUES (show_nexthub, 1, 'Season 1', 3)
  RETURNING id INTO season_id;

  INSERT INTO public.episodes (show_id, season_id, episode_number, title, description, duration, status, youtube_video_id) VALUES
    (show_nexthub, season_id, 1, 'Startup Pitch Day', 'Five startups pitch their ideas to a panel of investors.', 45, 'coming-soon', NULL),
    (show_nexthub, season_id, 2, 'Founder Stories', 'Successful Gulf entrepreneurs share their journeys.', 40, 'coming-soon', NULL),
    (show_nexthub, season_id, 3, 'The Investor Mindset', 'Venture capitalists reveal what they look for in startups.', 45, 'draft', NULL);

END $$;

-- Distinct catalog order 1..15 in seed order (shows.sort_order is NOT NULL default 0
-- since 20260520000000; without this every seeded show would sort as 0).
UPDATE public.shows AS s
SET sort_order = o.n
FROM (VALUES
  ('last-call', 1),
  ('review-documentary', 2),
  ('doctor-care', 3),
  ('saturn-podcast', 4),
  ('poets-platform', 5),
  ('kids-area', 6),
  ('infocus', 7),
  ('break-fast-daily', 8),
  ('meta-talk', 9),
  ('360', 10),
  ('music-hub', 11),
  ('laugh-or-leave', 12),
  ('island-cooke', 13),
  ('60-questions-challenge', 14),
  ('nexthub', 15)
) AS o(slug, n)
WHERE s.slug = o.slug;

-- Example shorts (was 20260425000001_seed_example_shorts.sql)
INSERT INTO public.shorts (youtube_video_id, title, channel_name, thumbnail_url, duration_seconds, genre, sort_order) VALUES
  ('RyWAAM7EkCE', 'Abu Dhabi Street Food Tour', 'Travel Eats', 'https://i.ytimg.com/vi/RyWAAM7EkCE/hq720.jpg', 58, 'Travel', 1),
  ('dQw4w9WgXcQ', 'Morning Routine in Dubai Marina', 'City Life UAE', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720.jpg', 45, 'Entertainment', 2),
  ('9bZkp7q19f0', 'Emirati Coffee in 60 Seconds', 'Culinary Shorts', 'https://i.ytimg.com/vi/9bZkp7q19f0/hq720.jpg', 60, 'Cooking', 3),
  ('kJQP7kiw5Fk', 'Sunset at Corniche Beach', 'Visit Abu Dhabi', 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hq720.jpg', 30, 'Travel', 4),
  ('JGwWNGJdvx8', 'Behind the Scenes: Studio Setup', 'Spacelight Studios', 'https://i.ytimg.com/vi/JGwWNGJdvx8/hq720.jpg', 52, 'Tech', 5),
  ('OPf0YbXqDm0', 'Arabic Calligraphy in Motion', 'Art Daily', 'https://i.ytimg.com/vi/OPf0YbXqDm0/hq720.jpg', 40, 'Culture', 6);

-- Fake show cast (was 20260506115421_seed_fake_show_cast.sql)
INSERT INTO public.show_cast (show_id, name, role, sort_order)
SELECT
  shows.id,
  cast_member.name,
  cast_member.role,
  cast_member.sort_order
FROM public.shows
CROSS JOIN (
  VALUES
    ('Amina Rahman', 'Host', 0),
    ('Omar Haddad', 'Director', 1),
    ('Layla Mansour', 'Producer', 2)
) AS cast_member(name, role, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.show_cast
  WHERE show_cast.show_id = shows.id
);

-- Fake cast images (was 20260506120139_add_fake_cast_images.sql)
UPDATE public.show_cast
SET image_url = CASE name
  WHEN 'Amina Rahman' THEN 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&h=240&q=80'
  WHEN 'Omar Haddad' THEN 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&h=240&q=80'
  WHEN 'Layla Mansour' THEN 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&h=240&q=80'
  ELSE image_url
END
WHERE name IN ('Amina Rahman', 'Omar Haddad', 'Layla Mansour')
  AND image_url IS NULL;
