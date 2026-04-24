-- Seed example shorts for Quick Bites section
-- These are real YouTube Shorts video IDs with manually provided metadata.

INSERT INTO shorts (youtube_video_id, title, channel_name, thumbnail_url, duration_seconds, genre, sort_order) VALUES
  ('RyWAAM7EkCE', 'Abu Dhabi Street Food Tour', 'Travel Eats', 'https://i.ytimg.com/vi/RyWAAM7EkCE/hq720.jpg', 58, 'Travel', 1),
  ('dQw4w9WgXcQ', 'Morning Routine in Dubai Marina', 'City Life UAE', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720.jpg', 45, 'Entertainment', 2),
  ('9bZkp7q19f0', 'Emirati Coffee in 60 Seconds', 'Culinary Shorts', 'https://i.ytimg.com/vi/9bZkp7q19f0/hq720.jpg', 60, 'Cooking', 3),
  ('kJQP7kiw5Fk', 'Sunset at Corniche Beach', 'Visit Abu Dhabi', 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hq720.jpg', 30, 'Travel', 4),
  ('JGwWNGJdvx8', 'Behind the Scenes: Studio Setup', 'Spacelight Studios', 'https://i.ytimg.com/vi/JGwWNGJdvx8/hq720.jpg', 52, 'Tech', 5),
  ('OPf0YbXqDm0', 'Arabic Calligraphy in Motion', 'Art Daily', 'https://i.ytimg.com/vi/OPf0YbXqDm0/hq720.jpg', 40, 'Culture', 6);
