# Domain Pitfalls

**Domain:** Netflix-style streaming platform (YouTube-embedded, CIT original content)
**Stack:** Next.js App Router + Supabase + YouTube Embeds + Tailwind CSS + Vercel
**Researched:** 2026-03-30

---

## Critical Pitfalls

Mistakes that cause rewrites, legal issues, or fundamental breakage.

### Pitfall 1: YouTube Suggested Videos Breaking the Premium Illusion

**What goes wrong:** After every episode ends, YouTube displays suggested/related videos -- including competitor content, random clickbait, or entirely unrelated videos. This destroys the "premium streaming platform" feel and sends viewers away from CIT content.

**Why it happens:** YouTube removed the ability to fully disable suggested videos. The `rel=0` parameter (since September 2018) only restricts suggestions to videos from the same YouTube channel -- it does not eliminate them. There is no parameter in 2026 that disables end-screen suggestions entirely.

**Consequences:** The platform feels like a YouTube wrapper instead of a premium service. Viewers click suggested videos and leave the platform. The "Netflix feel" is completely undermined at the most critical moment (episode end).

**Prevention:**
- Use `rel=0` to limit suggestions to CIT's own channel (mandatory baseline).
- Use the YouTube IFrame API `onStateChange` event to detect `YT.PlayerState.ENDED` and immediately trigger the "autoplay next episode" overlay, covering the suggestions before the viewer interacts with them.
- Design a compelling "next episode" card that appears over the player area the moment an episode ends (but do NOT overlay during playback -- that violates YouTube ToS).
- Use `modestbranding=1` to reduce YouTube branding (though this has limited effect in 2026).
- Consider using the `end` parameter to stop playback a few seconds before the actual end, triggering your own next-episode UI before YouTube shows suggestions.

**Detection:** Watch any embedded video to completion on the platform. If you see YouTube suggestions instead of a CIT "next episode" prompt, this pitfall is active.

**Phase relevance:** Must be addressed in the episode player/watch page phase. This is the single most important UX detail for maintaining the streaming platform illusion.

**Confidence:** HIGH (verified via official YouTube API documentation and multiple sources).

---

### Pitfall 2: YouTube Embed Overlay and Player Modification Violations (ToS Risk)

**What goes wrong:** Developers build custom play/pause buttons, progress bars, or branded overlays on top of the YouTube player to create a "custom player" look. YouTube issues a ToS violation, potentially blocking embeds or API access entirely.

**Why it happens:** The desire for a premium, branded player experience conflicts with YouTube's explicit rules. YouTube's Required Minimum Functionality states: "You must not display overlays, frames, or other visual elements in front of any part of a YouTube embedded player, including player controls." You also cannot "make changes to the YouTube player that are not explicitly described by the API documentation."

**Consequences:** YouTube can revoke API access. Embeds may stop working across the entire platform. Legal liability under YouTube API Terms of Service.

**Prevention:**
- NEVER place any visual element (div, overlay, custom controls, loading spinner, brand watermark) on top of the YouTube iframe during playback.
- Build the premium experience AROUND the player, not ON TOP of it. Cinematic background, show metadata, episode info, and next-episode suggestions should surround the player, not overlay it.
- Use only officially supported parameters (`autoplay`, `controls`, `color`, `rel`, `modestbranding`, `start`, `end`).
- The only safe moment to cover the player area is AFTER playback ends (via `onStateChange` detecting `ENDED` state), to show a next-episode card. Even then, replace the player rather than overlay it.

**Detection:** Code review for any CSS `position: absolute` or `z-index` values that could overlap the YouTube iframe. Audit all elements in the player container.

**Phase relevance:** Must be a hard rule from the very first player implementation. Retrofitting is painful because it means redesigning the entire watch experience.

**Confidence:** HIGH (verified via official YouTube Developer Policies and Required Minimum Functionality documentation).

---

### Pitfall 3: Brand Colors Fail WCAG Contrast on Dark Backgrounds

**What goes wrong:** The CIT brand's primary color -- Innovative Blue (#2C3569) -- is virtually invisible on dark backgrounds. Royal Purple (#9F54A0) and Crimson Red (#DB3F34) also fail WCAG AA for normal text on dark surfaces. The platform becomes inaccessible and text is unreadable.

**Why it happens:** The brand guidelines were designed for print/light contexts. Dark cinematic UIs demand colors with sufficient luminance, but three of the six brand colors do not meet WCAG AA 4.5:1 contrast ratio for normal text on black:

| Color | On #000000 | On #111111 | On #1A1A2E | AA Normal |
|-------|-----------|-----------|-----------|-----------|
| Innovative Blue (#2C3569) | 1.82:1 | 1.64:1 | 1.48:1 | **FAIL everywhere** |
| Royal Purple (#9F54A0) | 4.25:1 | 3.82:1 | 3.45:1 | **FAIL everywhere** |
| Crimson Red (#DB3F34) | 4.77:1 | 4.29:1 | 3.88:1 | Borderline / FAIL |
| Oasis Green (#50A258) | 6.65:1 | 5.98:1 | 5.40:1 | PASS |
| Sunset Orange (#EA8C2E) | 8.29:1 | 7.45:1 | 6.73:1 | PASS |
| Desert Sand Yellow (#F8C623) | 13.09:1 | 11.77:1 | 10.64:1 | PASS |
| White (#FFFFFF) | 21.00:1 | 18.88:1 | 17.06:1 | PASS |

**Consequences:** Innovative Blue as text or small UI elements is completely unreadable on dark backgrounds. Users with any visual impairment cannot use the platform. Accessibility lawsuits in the UAE/international markets. The platform looks broken, not cinematic.

**Prevention:**
- Use Innovative Blue ONLY for large decorative elements (category ribbons, pattern backgrounds, card borders) -- never for text or small interactive elements on dark surfaces.
- Use lightened/tinted variants of brand colors for text: e.g., a lighter blue (#5B6BAD or similar) that maintains brand identity while passing contrast ratios.
- Designate White (#FFFFFF) as the primary text color, with Sunset Orange or Oasis Green for accent text/links.
- Use Royal Purple and Crimson Red only for large text (24px+/bold 18.66px+) where WCAG AA Large (3:1 ratio) applies.
- Test every color combination with a contrast checker before implementing.

**Detection:** Run an automated accessibility audit (axe-core, Lighthouse) on every page. Any contrast warning involving brand colors means this pitfall is active.

**Phase relevance:** Must be resolved in the design system / UI foundation phase, before any pages are built. Retrofitting color choices across dozens of components is extremely expensive.

**Confidence:** HIGH (calculated from actual hex values using WCAG relative luminance formula).

---

### Pitfall 4: Supabase Auth Session Handling Breaks on Next.js App Router

**What goes wrong:** Users experience random logouts, "Invalid Refresh Token: Already Used" errors, or see another user's session. Authentication feels broken and unreliable.

**Why it happens:** Multiple interrelated issues with Supabase Auth + Next.js SSR:

1. **Race condition on token refresh:** When multiple Server Components or layouts call `supabase.auth.getUser()` simultaneously, they each try to refresh the same expired token. The first succeeds; subsequent calls get "Invalid Refresh Token: Already Used" because Supabase invalidates refresh tokens after single use.

2. **CDN caching leaking sessions:** If a CDN caches a response that includes `Set-Cookie` headers from token refresh, a different user receives the cached response and gets signed in as the wrong person.

3. **Route prefetching sending unauthenticated requests:** Next.js prefetches routes before the browser processes cookies, sending server-side requests without auth tokens. These requests fail or return unauthenticated data.

4. **Using `getSession()` for authorization:** `getSession()` reads cookies without verifying the JWT. A malicious client can craft a cookie with a spoofed user ID. Only `getClaims()` (local JWT validation) or `getUser()` (server-side verification) should be used.

**Consequences:** Users get logged out randomly. In worst case, users see another user's data (security breach). Platform feels unreliable. Users lose their watchlists and continue-watching progress.

**Prevention:**
- Follow the official Supabase SSR pattern exactly: refresh tokens in middleware (proxy), then pass refreshed cookies to Server Components so they never attempt their own refresh.
- Use `getClaims()` for fast authorization checks in Server Components (validates JWT signature locally).
- Use `getUser()` only when you need to verify the session is still active server-side (e.g., sensitive operations, profile changes).
- NEVER use `getSession()` for authorization decisions in server code.
- Set `Cache-Control: private, no-store` on all auth-related responses.
- Use `export const dynamic = 'force-dynamic'` on pages that read auth state -- never use ISR/SSG on authenticated pages.
- Subscribe to `onAuthStateChange` in client components to handle cross-tab login/logout.

**Detection:** Test multi-tab login/logout flows. Open the same page in multiple tabs and let sessions expire. If errors appear in console mentioning refresh tokens, this pitfall is active.

**Phase relevance:** Must be set up correctly in the authentication foundation phase. Getting this wrong early means every subsequent feature (watchlist, continue watching, admin panel) inherits the broken auth.

**Confidence:** HIGH (verified via Supabase official SSR documentation, GitHub issues #18981 and #30241, and official advanced guide).

---

### Pitfall 5: Supabase Row Level Security (RLS) Left Disabled or Misconfigured

**What goes wrong:** Database tables are publicly accessible through the Supabase API. Anyone with the anon key (which is public in frontend code) can read, modify, or delete all data -- shows, episodes, user watchlists, admin content.

**Why it happens:** RLS is disabled by default on every new Supabase table. Developers create tables, the app works in development, and they forget to enable RLS because there's no error -- everything "just works." In January 2025, 170+ production apps were found with exposed databases due to this exact mistake, with 83% involving RLS misconfigurations.

**Consequences:** Complete data exposure. Anyone can delete all shows/episodes via the public API. User data (emails, watchlists) is accessible to anyone. Admin content management can be hijacked.

**Prevention:**
- Enable RLS on EVERY table immediately after creation -- no exceptions.
- Create a migration checklist: every new table migration must include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- Create explicit policies for each operation (SELECT, INSERT, UPDATE, DELETE) on each table.
- Test RLS by querying from the client SDK (NOT the SQL Editor, which bypasses RLS).
- For public content (shows, episodes with status "published"), create a SELECT policy like `USING (status = 'published')`.
- For user data (watchlist, watch progress), create policies scoped to `auth.uid()`.
- For admin operations, create policies that check against an admin user ID or admin role in user metadata.
- Index all columns referenced in RLS policies to avoid performance degradation.

**Detection:** Try querying any table using the anon key from a browser console or Postman without being authenticated. If data comes back, RLS is broken.

**Phase relevance:** Must be enforced from the very first database table creation. Every migration should be audited for RLS. Create a "no table without RLS" rule in the project.

**Confidence:** HIGH (verified via Supabase official documentation and real-world breach reports).

---

## Moderate Pitfalls

Mistakes that cause significant rework, poor UX, or performance issues.

### Pitfall 6: YouTube Embeds Destroying Core Web Vitals and Page Load Performance

**What goes wrong:** Pages with YouTube embeds load slowly, especially the home page with multiple show previews or the watch page. A single YouTube embed adds 1.3-2.6 MB to the page and makes 20+ HTTP requests before the viewer clicks play. LCP tanks, CLS spikes from unsized iframes, and the page feels sluggish.

**Why it happens:** The YouTube iframe eagerly loads its full JavaScript player, stylesheets, and connection infrastructure even if the user never clicks play. On a catalog page that might show video previews, this multiplies catastrophically.

**Prevention:**
- Implement the **facade pattern** for all YouTube embeds except the active watch page player. Show a thumbnail image + play button; only load the actual iframe when the user clicks.
- Use `lite-youtube-embed` or a custom React component that renders a static thumbnail with a play button overlay, lazy-loading the real iframe on interaction.
- On the watch page (where the video IS the primary content), use `loading="eager"` for the single active player but still set explicit `width` and `height` attributes to prevent CLS.
- For catalog pages / home page, NEVER embed actual YouTube iframes. Use YouTube thumbnail URLs (`https://img.youtube.com/vi/{VIDEO_ID}/maxresdefault.jpg`) as static images.
- Set explicit `aspect-ratio: 16/9` on all video containers to prevent layout shift.

**Detection:** Run Lighthouse on any page with embedded videos. LCP above 2.5s or CLS above 0.1 indicates this pitfall is active.

**Phase relevance:** Must be implemented from the first video-related UI component. Retrofitting facades into an existing embed architecture is moderate effort.

**Confidence:** HIGH (verified via multiple performance analysis sources and Core Web Vitals documentation).

---

### Pitfall 7: Autoplay Next Episode Fails Due to Browser Policies

**What goes wrong:** The "autoplay next episode" feature -- a core Netflix-like behavior -- silently fails. The next video loads but does not play, leaving the viewer staring at a paused player. On mobile, this is even more likely to fail.

**Why it happens:** Modern browsers enforce strict autoplay policies. Autoplay with sound requires prior user interaction (a "user gesture"). The YouTube IFrame API's autoplay parameter requires `mute=1` to work reliably. Mobile browsers have even stricter policies that may block autoplay entirely, even when muted.

**Consequences:** The "continue watching" / binge-watching flow breaks. Users must manually click play for every episode, destroying the streaming platform experience. Mobile users are disproportionately affected.

**Prevention:**
- When transitioning to the next episode, load the new video with `autoplay=1&mute=1` to ensure it starts.
- Immediately after the new video starts playing (detected via `onStateChange`), call `player.unMute()` to restore audio. This works because the initial autoplay (muted) counts as a user-initiated playback context in most browsers.
- Show a visible "Next episode starting..." countdown overlay (like Netflix) with a cancel button. This serves dual purpose: it gives users control AND the interaction with the countdown UI counts as a user gesture.
- If autoplay truly fails (detected by checking player state after a timeout), show a prominent "Continue Playing" button rather than leaving the user confused.
- Test extensively on mobile Safari, Chrome Android, and Firefox -- each has different autoplay policies.

**Detection:** Test the episode-to-episode transition flow on mobile devices. If the next episode loads but doesn't play, this pitfall is active.

**Phase relevance:** Must be addressed when building the watch page and episode navigation. This is the moment where the "Netflix feel" either works or breaks.

**Confidence:** MEDIUM (browser autoplay policies are well-documented, but the mute-then-unmute workaround behavior varies by browser and is not guaranteed long-term).

---

### Pitfall 8: Empty Platform Syndrome -- Launching With Few Shows Looks Abandoned

**What goes wrong:** With only a few of the 15 planned shows available at launch (and many in production), the platform looks empty, broken, or abandoned. Content rails show 2-3 cards with vast empty space. The hero section has nothing compelling to rotate through. The "Coming Soon" section dominates the "Now Streaming" section.

**Why it happens:** The platform is designed for a full 15-show, 294-episode catalog, but content is being produced gradually. Most shows have 0 episodes ready at launch. The design doesn't account for the "sparse content" state.

**Consequences:** New visitors assume the platform is dead or in beta. The "premium streaming" illusion fails when there's nothing to stream. Repeat visitors have nothing new to watch and don't return.

**Prevention:**
- Design the catalog UI to look intentional at EVERY content level (1 show, 5 shows, 15 shows). Use flexible grid layouts that redistribute gracefully.
- Lean heavily into "Coming Soon" as a feature, not a deficit. Show cinematic teasers, production behind-the-scenes, countdown timers, and "notify me" buttons for upcoming shows.
- Create curated collections that repackage the same content in different ways: "Latest Episodes," "Staff Picks," "Short Watch" (< 30min), "New This Week" -- even with few shows, these can create the illusion of more content.
- Feature episodes prominently, not just shows. If you have 3 shows with 10 episodes each, that is 30 pieces of content to browse.
- Use the broadcast schedule as a content rail: "On Now," "Up Next," "Tonight's Schedule" create a sense of live activity.
- Fill visual space with show artwork, brand patterns, and behind-the-scenes imagery rather than empty grids.

**Detection:** View the home page with only 1-3 published shows. If it looks sparse, empty, or broken, this pitfall is active.

**Phase relevance:** Must be addressed during home page and catalog design. The design system must accommodate sparse content from day one.

**Confidence:** HIGH (fundamental UX principle, supported by streaming platform UX guidelines).

---

### Pitfall 9: Arabic/RTL Content Breaks Layout When Mixed With LTR

**What goes wrong:** Arabic show titles, episode descriptions, and bilingual content cause layout breaking -- text alignment is wrong, spacing is mirrored incorrectly, and mixed Arabic/English text displays in the wrong order. Some elements flip when they shouldn't (e.g., video player controls), while others don't flip when they should (e.g., navigation arrows).

**Why it happens:** Developers use directional CSS properties (`margin-left`, `padding-right`, `left`, `right`) instead of logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`). Arabic text needs 1.6-1.8x line height vs 1.4-1.5x for English. Arabic glyphs are visually smaller than Latin characters at the same font size. The `dir="rtl"` attribute affects all children, including elements that should remain LTR (like numbers, URLs, and embedded players).

**Consequences:** Arabic content is unreadable or misaligned. The platform appears broken for Arabic-speaking users. Mixed-direction text (Arabic title with English subtitle) displays incorrectly.

**Prevention:**
- Use CSS logical properties everywhere: `margin-inline-start` instead of `margin-left`, `padding-inline-end` instead of `padding-right`, `inset-inline-start` instead of `left`.
- In Tailwind CSS, use the `rtl:` and `ltr:` variants for direction-specific styles, or use logical property utilities (`ms-`, `me-`, `ps-`, `pe-` for margin/padding start/end).
- Set `dir` attribute at the content level, not the page level. A show with an Arabic title can have `dir="rtl"` on just the title element, keeping the rest of the page LTR.
- Use the `<bdi>` HTML element to isolate bidirectional text in dynamic content.
- Load Arabic-specific fonts (Daken Black for headlines, Avenir Arabic for body) and set appropriate line-height and font-size adjustments for Arabic text.
- The YouTube player should NEVER be affected by RTL -- always wrap it in a `dir="ltr"` container.
- Test every component with both pure Arabic, pure English, and mixed content.

**Detection:** Set any show title to Arabic text and view it on the platform. If alignment, spacing, or text direction looks wrong, this pitfall is active.

**Phase relevance:** Must be considered in the design system / component library phase. Using logical properties from the start is trivial; retrofitting hundreds of directional CSS values is a full rewrite of styles.

**Confidence:** HIGH (well-documented CSS/i18n challenge, verified via RTL styling guides and Next.js i18n documentation).

---

### Pitfall 10: "Continue Watching" Progress Tracking Is Unreliable With YouTube API

**What goes wrong:** The "continue watching" feature shows wrong progress, loses track of where users left off, or creates phantom entries for videos the user barely started. Progress percentage is inaccurate, especially when users scrub around the timeline.

**Why it happens:** The YouTube IFrame API provides `getCurrentTime()` and `getDuration()` for progress tracking, but these have quirks:
- `getDuration()` may return 0 or inaccurate values until the video has loaded sufficiently.
- `getCurrentTime()` during scrubbing fires rapid, unreliable values.
- There is no native "progress percentage" event -- you must poll with `setInterval`, which is battery-draining on mobile and can miss the actual exit moment.
- When the user closes the browser tab, there's no guaranteed `beforeunload` event to save final progress (especially on mobile Safari).
- Saving progress on every poll creates excessive Supabase writes.

**Consequences:** Users see episodes at "15% watched" when they actually watched 80%. The continue-watching rail shows episodes the user glanced at for 3 seconds. Resuming playback starts at the wrong timestamp.

**Prevention:**
- Poll `getCurrentTime()` at reasonable intervals (every 10-15 seconds, not every second).
- Debounce progress saves to Supabase -- batch updates rather than saving on every poll tick.
- Only create a "continue watching" entry after the user has watched more than 30 seconds or 5% of the video (whichever is greater). This prevents phantom entries from accidental clicks.
- Mark an episode as "completed" when progress exceeds 90% (not 100%, because users often stop before credits finish).
- Use `onStateChange` to detect PAUSED and ENDED states as reliable save points, in addition to interval polling.
- Use the `visibilitychange` event (more reliable than `beforeunload` on mobile) to save progress when the user switches tabs or backgrounds the browser.
- Store the YouTube video duration in the database alongside the episode record, so you don't depend on the API returning it correctly every time.

**Detection:** Watch an episode partway, close the tab, and return. If the "continue watching" entry is missing, shows the wrong progress, or resumes at the wrong time, this pitfall is active.

**Phase relevance:** Addressed during the watch page and user features phase. Requires the YouTube player integration and Supabase user data to both be in place.

**Confidence:** MEDIUM (YouTube API behaviors are documented, but progress tracking edge cases require empirical testing).

---

### Pitfall 11: Admin Panel Complexity Creep and Security Bleed

**What goes wrong:** The admin panel starts simple ("paste a YouTube URL") but grows to manage shows, seasons, episodes, statuses, artwork, schedules, and ordering. It becomes the most complex part of the codebase. Worse, admin routes in the same Next.js app risk security bleed if middleware or route protection is misconfigured.

**Why it happens:** The admin is building blocks for the entire public experience. Every public feature (show catalog, episode list, broadcast schedule) requires a corresponding admin CRUD interface. The scope is deceptively large: 15 shows x seasons x episodes x status management x artwork uploads x YouTube URL connections x schedule configuration.

**Consequences:** Admin panel development takes longer than the public-facing platform. A misconfigured route exposes admin endpoints to unauthenticated users. The admin and public UI share components in confusing ways.

**Prevention:**
- Keep admin routes under a clear `/admin` route group with a dedicated layout that checks admin authentication in BOTH middleware AND the layout Server Component (defense in depth).
- Use `getUser()` (not just `getClaims()`) for admin routes to ensure the session is truly valid server-side -- admin operations warrant the extra latency.
- Create admin-specific Supabase RLS policies that check against the admin user's ID. Do not rely solely on client-side route protection.
- Design the admin panel as a simple, functional tool -- NOT a second polished product. Use a component library like shadcn/ui for rapid admin CRUD development.
- Prioritize admin features by public-facing dependency: build the admin for shows/episodes first (blocks the public catalog), schedule management second, artwork upload third.
- Set shorter session durations for admin (15 minutes idle timeout vs 24 hours for regular users).

**Detection:** Try accessing `/admin` routes without being authenticated, or as a non-admin authenticated user. If any admin content is visible, this pitfall is active.

**Phase relevance:** Admin panel should be built alongside or slightly ahead of the public features it supports, but scoped strictly to what the current phase requires. Do not build the full admin upfront.

**Confidence:** HIGH (standard web security principle, verified via Next.js security best practices documentation).

---

## Minor Pitfalls

Mistakes that cause friction, technical debt, or subtle UX degradation.

### Pitfall 12: Service Role Key Exposed in Frontend Code

**What goes wrong:** The Supabase service role key (which bypasses all RLS) is placed in a `NEXT_PUBLIC_` environment variable or accidentally bundled into client-side code.

**Prevention:**
- Service role key must ONLY exist in `SUPABASE_SERVICE_ROLE_KEY` (without `NEXT_PUBLIC_` prefix).
- Use it exclusively in Server Actions, Route Handlers, or server-only utility files.
- Add `server-only` package import to any file that uses the service role client.
- Add `.env.local` to `.gitignore` and document required env vars in a `.env.example`.

**Detection:** Search the codebase for `NEXT_PUBLIC_SUPABASE_SERVICE` or any reference to the service role key in client components.

**Phase relevance:** Set up correctly in project initialization. Never revisit.

---

### Pitfall 13: Hero Banners and Show Artwork Not Optimized for Performance

**What goes wrong:** Large show artwork images (hero banners, thumbnails, logos) are served unoptimized, causing slow page loads. A 2MB hero banner that could be 180KB at the correct resolution.

**Prevention:**
- Use `next/image` for ALL images. Never use raw `<img>` tags.
- Set `priority` prop on above-the-fold hero images for LCP optimization.
- Define responsive `sizes` attribute: `sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"`.
- Store show artwork in Supabase Storage and use its image transformation API (available on Pro plan) for on-the-fly resizing and format optimization (auto-WebP/AVIF).
- If on Free plan, pre-generate multiple image sizes during upload and use `next/image` with appropriate `srcSet`.
- Use `placeholder="blur"` with `blurDataURL` for cinematic loading effects.

**Detection:** Run Lighthouse. Any image optimization warnings or LCP above 2.5s indicates this pitfall.

**Phase relevance:** Implement in the design system phase. The `next/image` wrapper should be the standard from component #1.

---

### Pitfall 14: Supabase Views Bypassing RLS

**What goes wrong:** Database views created for complex queries (e.g., "shows with episode counts" or "trending episodes") bypass RLS by default, exposing data that should be filtered.

**Prevention:**
- On Postgres 15+ (which Supabase uses), add `WITH (security_invoker = true)` to all view definitions.
- Alternatively, use Supabase database functions with `SECURITY INVOKER` instead of views.
- Test views from the client SDK to verify RLS applies.

**Detection:** Query a view from an unauthenticated client. If it returns data that should be restricted, RLS is bypassed.

**Phase relevance:** Relevant when building complex data queries, typically in the catalog/home page phase.

---

### Pitfall 15: ISR/SSG Used on Authenticated Pages

**What goes wrong:** Statically generated or ISR-cached pages serve stale or wrong auth state. A user sees "Sign In" when they're logged in, or sees another user's watchlist.

**Prevention:**
- Any page that reads auth state must use `export const dynamic = 'force-dynamic'`.
- Public catalog pages (show listings, episode details) CAN use ISR/SSG for performance.
- Separate auth-dependent UI into client components that hydrate after page load.
- Use `revalidatePath()` or `revalidateTag()` for admin content updates to public catalog pages.

**Detection:** Sign in, visit a page, sign out in another tab, refresh. If the first tab still shows authenticated UI, caching is leaking auth state.

**Phase relevance:** Must be understood when setting up page rendering strategies in the routing/layout phase.

---

### Pitfall 16: YouTube Video ID Extraction and URL Validation Brittleness

**What goes wrong:** The admin pastes YouTube URLs in various formats (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`, `youtube.com/shorts/`, URLs with extra query params), and the video ID extraction breaks for some formats, resulting in broken embeds.

**Prevention:**
- Build a robust URL parser that handles ALL YouTube URL formats:
  - `https://www.youtube.com/watch?v=VIDEO_ID`
  - `https://youtu.be/VIDEO_ID`
  - `https://www.youtube.com/embed/VIDEO_ID`
  - `https://youtube.com/shorts/VIDEO_ID`
  - URLs with timestamps (`?t=123`), playlists (`&list=`), and other params
- Validate the extracted video ID format (11 alphanumeric characters + hyphens/underscores).
- After extraction, verify the video exists using YouTube's oEmbed endpoint (`https://www.youtube.com/oembed?url=...&format=json`) -- no API key needed.
- Store only the video ID in the database, not the full URL. Construct embed URLs at render time.
- Show a video preview thumbnail in the admin panel after URL input to confirm the correct video was linked.

**Detection:** Paste various YouTube URL formats into the admin panel. If any format fails to embed correctly, this pitfall is active.

**Phase relevance:** Admin panel phase, specifically the episode management feature.

---

### Pitfall 17: Broadcast Schedule Timezone Confusion

**What goes wrong:** The broadcast schedule shows incorrect times for users in different timezones. "Break Fast Daily at 11:00 AM" -- 11:00 AM in which timezone? Abu Dhabi (UTC+4)? The viewer's local time?

**Prevention:**
- Store all schedule times in UTC in the database.
- Display times in the viewer's local timezone, with an explicit timezone label: "11:00 AM GST (Gulf Standard Time)" or "3:00 PM your time."
- Use `Intl.DateTimeFormat` for client-side timezone conversion.
- Show the Abu Dhabi timezone as the "official" broadcast time with a "your time" conversion.
- Be aware that the UAE does not observe daylight saving time, but viewers in other regions do -- conversions change seasonally.

**Detection:** View the broadcast schedule from a browser set to a non-UAE timezone. If times are wrong or ambiguous, this pitfall is active.

**Phase relevance:** Broadcast schedule feature phase.

---

### Pitfall 18: Missing Error and Loading States for YouTube Player

**What goes wrong:** When a YouTube video is unavailable (deleted, made private, region-restricted, or YouTube is down), the embedded player shows a cryptic YouTube error message or a blank black rectangle. The user has no idea what happened or what to do.

**Prevention:**
- Listen to the YouTube IFrame API `onError` event and display a custom, branded error message: "This episode is temporarily unavailable. Try again later or watch another episode."
- Handle specific error codes: 2 (invalid video ID), 5 (HTML5 player error), 100 (video not found/private), 101/150 (embedding disabled by video owner).
- For error code 100 (video removed), flag the episode in the database and notify the admin.
- Show a loading skeleton/spinner while the YouTube player initializes (it can take several seconds on slow connections).
- Implement a timeout: if the player hasn't loaded within 10 seconds, show a "Having trouble loading? Try refreshing" message.

**Detection:** Set an episode's YouTube URL to an invalid or deleted video ID. If the player shows a raw YouTube error, this pitfall is active.

**Phase relevance:** Watch page / player component phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Design system / UI foundation | Brand colors fail contrast (Pitfall 3) | Calculate all color combinations against WCAG before building any component |
| Design system / UI foundation | RTL layout breaks (Pitfall 9) | Use CSS logical properties from the start |
| Authentication setup | Auth session race conditions (Pitfall 4) | Follow Supabase SSR guide exactly; test multi-tab flows |
| Authentication setup | Service key exposure (Pitfall 12) | Enforce env var naming conventions day one |
| Database schema | RLS disabled by default (Pitfall 5) | Enable RLS on every table, no exceptions |
| Database schema | Views bypass RLS (Pitfall 14) | Use security_invoker on all views |
| Home page / catalog | Empty platform syndrome (Pitfall 8) | Design for 1-3 shows first, not 15 |
| Home page / catalog | Image performance (Pitfall 13) | Use next/image with priority and sizes |
| Home page / catalog | Video embed performance (Pitfall 6) | Use facade pattern, never real iframes on catalog pages |
| Watch page / player | YouTube ToS violation (Pitfall 2) | No overlays on player, ever |
| Watch page / player | Suggested videos leak (Pitfall 1) | End-of-video detection + next-episode overlay |
| Watch page / player | Autoplay next episode fails (Pitfall 7) | Mute-first strategy + countdown UI |
| Watch page / player | Progress tracking unreliable (Pitfall 10) | Debounced polling + visibility change save |
| Watch page / player | Player error states (Pitfall 18) | Handle all onError codes with branded fallback |
| Admin panel | Complexity creep (Pitfall 11) | Scope admin to current phase needs only |
| Admin panel | YouTube URL parsing (Pitfall 16) | Robust multi-format parser + preview validation |
| Broadcast schedule | Timezone confusion (Pitfall 17) | Store UTC, display local + GST |
| Authenticated pages | ISR caching auth state (Pitfall 15) | force-dynamic on all auth-dependent pages |

---

## Sources

### Official Documentation (HIGH confidence)
- [YouTube Player API Reference for iframe Embeds](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube Embedded Players and Player Parameters](https://developers.google.com/youtube/player_parameters)
- [YouTube API Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)
- [Complying with YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies-guide)
- [Supabase: Setting up Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase: Auth Server-Side Advanced Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase: Auth Troubleshooting](https://supabase.com/docs/guides/auth/troubleshooting)
- [Supabase: Storage Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations)
- [Next.js: Image Component](https://nextjs.org/docs/app/api-reference/components/image)
- [Next.js: Video Guides](https://nextjs.org/docs/app/guides/videos)

### Verified Technical Sources (MEDIUM confidence)
- [Supabase GitHub Issue #18981: Refresh token errors in @supabase/ssr](https://github.com/supabase/supabase/issues/18981)
- [Supabase GitHub Issue #30241: Stop using middleware for token refresh](https://github.com/supabase/supabase/issues/30241)
- [Supabase GitHub Issue #40985: Clarify getClaims vs getUser](https://github.com/supabase/supabase/issues/40985)
- [Why YouTube Embeds Hurt Your Website (2026)](https://swarmify.com/blog/why-youtube-embeds-hurt-your-website/)
- [Perfect YouTube Core Web Vitals](https://www.corewebvitals.io/pagespeed/perfect-youtube-core-web-vitals)
- [Embedding YouTube Videos Without Slowing Down Your Site](https://blog.openreplay.com/embedding-youtube-videos/)
- [NNGroup: Dark Mode Issues](https://www.nngroup.com/articles/dark-mode-users-issues/)
- [Dark Mode Accessibility Guide](https://www.accessibilitychecker.org/blog/dark-mode-accessibility/)
- [RTL Styling 101](https://rtlstyling.com/posts/rtl-styling/)
- [6 Common Supabase Auth Mistakes](https://startupik.com/6-common-supabase-auth-mistakes-and-fixes/)
- [Supabase RLS Guide: Policies That Actually Work](https://designrevision.com/blog/supabase-row-level-security)
- [Next.js Security Best Practices 2026](https://www.authgear.com/post/nextjs-security-best-practices)

### WCAG Contrast Analysis (HIGH confidence)
- Calculated using WCAG 2.1 relative luminance formula against actual CIT brand hex values
- Tested against three dark background variants: #000000, #111111, #1A1A2E
