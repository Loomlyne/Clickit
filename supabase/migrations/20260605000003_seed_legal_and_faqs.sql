-- Seed legal page content from existing platform copy
-- Terms of Use and Privacy Policy sourced from src/messages/en.json

update public.legal_pages
set content = '1. Acceptance
By accessing or using the Clickit Story platform, you agree to be bound by these Terms of Use. If you do not agree, do not use the platform.

2. Platform Access
Clickit Story grants you a limited, non-exclusive, non-transferable licence to access and stream content on the platform for personal, non-commercial use.

3. Content
All content on Clickit Story is owned by or licensed to Spacelight Studios FZ LLC. You may not copy, reproduce, distribute, or create derivative works from any content without express written permission.

4. User Accounts
You are responsible for maintaining the confidentiality of your account credentials. Clickit Story reserves the right to suspend or terminate accounts that violate these terms.

5. Changes
We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the revised terms.

6. Contact
Questions about these terms? Reach us via the support page at clickitstory.com/support.'
where slug = 'terms-of-use';

update public.legal_pages
set content = '1. Information We Collect
We collect information you provide when creating an account (email address), and usage data such as watch history and saved lists. We do not sell your personal data.

2. How We Use It
Your data is used solely to operate the platform — to remember your progress, maintain your watchlist, and improve the service. We do not use your data to serve targeted advertisements.

3. Video Streaming
Content is delivered via YouTube embeds. When you watch a video, YouTube''s own privacy policy applies to that playback session. We recommend reviewing Google''s Privacy Policy at policies.google.com/privacy.

4. Data Storage
Account data is stored securely via Supabase (hosted on AWS infrastructure in the EU region). Passwords are never stored in plain text.

5. Your Rights
You may request deletion of your account and associated data at any time via the support page at clickitstory.com/support.

6. Cookies
We use session cookies strictly necessary for authentication. No third-party advertising cookies are set by Clickit Story.'
where slug = 'privacy-policy';

-- Seed FAQs from landing page copy (src/messages/en.json landing section)
insert into public.faqs (question, answer, sort_order) values
  ('What is Clickit?', 'Clickit is a curated streaming service for original shows produced in Abu Dhabi. Every show is hand-picked by our editors.', 1),
  ('How much does it cost?', 'Clickit is free during open beta. No subscription required — just sign up and start watching.', 2),
  ('Which devices are supported?', 'Any modern browser on desktop, tablet, or mobile. Our shows stream via YouTube for maximum compatibility.', 3),
  ('Where does the content come from?', 'All content is original, produced by Spacelight Studios FZ LLC from Yas Creative Hub, Abu Dhabi.', 4),
  ('How many shows are available?', 'We currently have 15 original programs spanning travel, health, music, comedy, cooking, kids, poetry, cinema, tech, and more.', 5)
on conflict do nothing;
