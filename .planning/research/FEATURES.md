# Feature Landscape

**Domain:** Cinematic streaming platform (YouTube-embed based)
**Researched:** 2026-03-30

## Table Stakes

Features users expect from a streaming platform. Missing = feels broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Show catalog with visual browsing | Netflix trained every user to expect cinematic card grids | Medium | Hero banner + horizontal content rails. Must feel premium, not like a YouTube channel listing. |
| Series detail page with seasons | Users expect to pick a season, then browse episodes | Medium | Season tabs/selector, episode list with thumbnails and descriptions. |
| Episode watch page | Core value proposition -- click and watch | Medium | YouTube IFrame embed, episode metadata, prev/next navigation. |
| User authentication | Required for personalized features (watchlist, continue watching) | Low | Supabase Auth handles email/password + social login. |
| Responsive design | 40-60% of streaming traffic is mobile | Medium | Must work well on phones. Video player aspect ratio handling is critical. |
| Search | Users expect to find content by name | Low | Postgres FTS is sufficient. Search bar in header, results page. |
| Show/episode status management | Content is still being produced -- must handle unreleased content | Low | Draft (admin only), Coming Soon (visible but not watchable), Published (watchable). |
| Admin content management | Single admin needs to add/edit shows, seasons, episodes | Medium | CRUD forms, YouTube URL input, status toggles, image upload for artwork. |
| Dark cinematic UI | Streaming platforms are universally dark. Light UI would feel wrong. | Low | Tailwind dark theme as default. CIT brand colors as accents. |

## Differentiators

Features that elevate CIT above "just a YouTube channel with a website wrapper."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Continue watching with progress tracking | Remembers where you left off, resumes playback. Makes it feel like a real streaming service. | Medium | Requires YouTube IFrame API `getCurrentTime()` + periodic progress saves to Supabase. Interval-based (every 10-15 seconds while playing). |
| Watchlist | Personal "My List" for shows to watch later | Low | Simple join table: `user_id + show_id`. Toggle button on show cards. |
| Autoplay next episode | Seamless binge experience -- episode ends, next one starts | Medium | YouTube `onStateChange` ENDED event triggers next episode load. Optional countdown overlay before auto-advance. |
| Broadcast schedule display | Connects the digital platform to CIT's production schedule | Low | Static schedule data (day/time per show). Display as a weekly grid. Shows "LIVE NOW" badge when a show is airing. |
| Coming Soon page | Builds anticipation for unreleased shows/episodes | Low | Filter by status="coming_soon". Show artwork, description, expected release. |
| Per-show branded identity | Each show has its own color ribbon and pattern from CIT brand guide | Medium | 5 brand color sets mapped to shows. Show-specific header/hero treatments. Pattern overlays on cards. |
| Bilingual content support | Arabic and English content for UAE audience | Medium | Content stored in both languages. Language toggle for descriptions. RTL layout for Arabic. |

## Anti-Features

Features to explicitly NOT build in v1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Self-hosted video / video uploads | Massive infrastructure cost and complexity. YouTube handles transcoding, CDN, adaptive bitrate. | Keep YouTube as video host. Admin pastes YouTube URL. |
| Payment / subscription system | All content is free for v1. Premature monetization adds complexity without value. | Remove all paywall logic. If needed later, Stripe + Supabase is well-documented. |
| Comments / chat | Moderation burden for a small team. YouTube already has comments on the videos. | Link to the YouTube video page for comments if needed. |
| Role-based access control | Single admin. Building RBAC for one user is waste. | Hardcode admin check: `user.id === ADMIN_USER_ID` or admin flag in profiles table. |
| Mobile native app | v1 is web-first. React Native is a separate codebase to maintain. | Build responsive web app. Progressive Web App (PWA) is a lightweight alternative later. |
| Recommendation engine | ML-based recommendations need usage data that doesn't exist yet. | Curate content manually. "Featured" flag on shows. Category-based browsing. |
| Analytics dashboard | No data to analyze on day one. Build this after launch when there's traffic. | Use Vercel Analytics (free tier) for basic web metrics. |
| Notification system | Email/push notifications need infrastructure and compliance (CAN-SPAM, etc). | Defer to v2. Use the Coming Soon page to surface new content. |
| Trailer hover preview | Netflix-style auto-playing trailers on hover. Technically complex with YouTube embeds (each hover = iframe load). | Static thumbnail hover effects (scale, overlay). Trailer can be the first episode or a dedicated YouTube short linked from the show page. |
| Real-time features | WebSocket subscriptions add complexity for a content platform where content changes are infrequent. | Standard HTTP requests. Admin publishes -> user refreshes -> sees update. ISR/revalidation handles staleness. |
| Download for offline | YouTube embed API does not support download. Would require self-hosted video. | Not possible with YouTube-only architecture. Explicitly out of scope. |

## Feature Dependencies

```
Authentication
  -> Watchlist (requires user identity)
  -> Continue Watching (requires user identity + progress tracking)
  -> Admin Dashboard (requires admin auth check)

Show Catalog
  -> Series Detail Page (requires shows to exist)
  -> Search (requires shows/episodes to search over)

Series Detail Page
  -> Episode Watch Page (requires episode selection)

Episode Watch Page
  -> YouTube IFrame API integration
  -> Continue Watching progress tracking (writes progress data)
  -> Autoplay Next Episode (reads episode ordering)

Admin Dashboard
  -> YouTube URL connection (episode creation)
  -> Show/Season/Episode CRUD
  -> Status management (draft/coming soon/published)
  -> Image upload (show artwork to Supabase Storage)

Bilingual Support (next-intl)
  -> Can be added incrementally. Start with English UI, add Arabic translations per-page.
```

## MVP Recommendation

### Phase 1: Core Streaming Experience

Build these first -- they constitute the minimum viable streaming platform:

1. **Show catalog with hero and content rails** -- the landing page experience
2. **Series detail page with season browser** -- discover episodes
3. **Episode watch page with YouTube embed** -- the core value
4. **User authentication** -- gate for personalization
5. **Basic search** -- find content
6. **Admin CRUD** -- populate the platform with content

### Phase 2: Engagement

These make it feel like a real streaming service:

7. **Watchlist** -- (low complexity, high perceived value)
8. **Continue watching** -- (medium complexity, high retention value)
9. **Autoplay next episode** -- (medium complexity, binge enabler)
10. **Show status management** -- (draft/coming soon/published)

### Phase 3: Polish

These complete the premium experience:

11. **Broadcast schedule** -- connects platform to production
12. **Coming Soon page** -- anticipation building
13. **Per-show branded identity** -- visual richness
14. **Bilingual support** -- Arabic content and RTL

### Defer

- **Analytics dashboard**: No data yet. Use Vercel Analytics.
- **Notifications**: Complexity without clear value in v1.
- **Trailer hover previews**: Technical complexity with YouTube embeds. Static hover effects are sufficient.

## Sources

- [YouTube IFrame API Reference](https://developers.google.com/youtube/iframe_api_reference) -- feature capability assessment
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth) -- auth feature assessment
- Project requirements from PROJECT.md -- HIGH confidence
