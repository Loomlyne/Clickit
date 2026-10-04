# Feature Research

**Domain:** Premium streaming catalog over a YouTube channel (embedded YouTube player), bilingual Arabic/English, UAE audience, two-admin ops
**Researched:** 2026-10-04
**Confidence:** MEDIUM-HIGH (YouTube embed rules, player params, Supabase OTP and PlaylistItems quota verified against official docs; UX norms from streaming-product convention and training data, flagged where LOW)

Scope: brownfield milestone. Catalog, player, resume, autoplay-next, progress, My List, likes, reviews, shorts, admin CRUD, scheduling already exist (PROJECT.md "Validated"). This file covers how the *target* features of this milestone are expected to behave, and what a YouTube-embedded streaming product can and cannot do.

---

## 0. Hard limits of a YouTube-embedded product (read first)

These are not features to build; they bound every viewer-facing feature below. Verified against Google's official pages.

| Constraint | Source / status | What it means for CIT |
|---|---|---|
| No overlays, frames or visual elements in front of any part of the embedded player, including controls | YouTube API Services, Required Minimum Functionality (HIGH) | Custom chrome (titles, "Up next", buttons, gradients) must sit **outside** the iframe box, or the iframe must be removed/hidden when the overlay shows. **Existing `autoplay-overlay.tsx` renders `absolute inset-0 z-20` over the player area at video end — flag for review.** Loading/error states before the iframe exists are fine. |
| No changes to the player not described in the API docs | RMF (HIGH) | No custom-skinned controls over the iframe, no CSS cropping of YouTube branding, no `pointer-events:none` tricks. |
| Minimum viewport 200x200; 16:9 recommended ≥480x270 | RMF (HIGH) | Mobile mini-player / picture-in-picture rails must respect the minimum. |
| Autoplay: max one autoplaying YouTube player per page; only when >50% visible | RMF (HIGH) | Hero background must stay the R2 MP4 (not a YouTube autoplay). Shorts overlay must pause the main player before another autoplays. |
| No mouseover/touch on the player triggering actions on the user's behalf | RMF (HIGH) | No hover-to-preview that starts a YouTube player in the catalog. Hover previews must use the R2 MP4 or static artwork. |
| Playback-initiating thumbnails ≥120x70 | RMF (HIGH) | Episode cards fine; tiny "play" chips in dense lists are not. |
| `modestbranding` deprecated (2023-08-15), no effect | Player parameters (HIGH) | YouTube logo/branding cannot be removed. Design around it. |
| `showinfo` deprecated (2018); title + channel avatar always shown before playback | Player parameters (HIGH) | Pre-play state will show YouTube's title bar. Use a click-to-load poster (lite-embed pattern) so the branded CIT poster is what viewers see first. |
| `rel=0` only limits end-screen suggestions to the same channel | Player parameters (HIGH) | End-of-video suggestions will be CIT's own channel — acceptable, but they will compete with CIT's autoplay-next. Hand off before the end screen (existing 95% mark helps). |
| Quality selection is YouTube's; `setPlaybackQuality` is a no-op in current API (LOW/MEDIUM, training data) | — | No CIT quality picker. Viewers use the YouTube gear menu. |
| Ads are YouTube's decision (monetized channel shows ads in embeds) | YouTube policy (MEDIUM) | CIT cannot suppress or insert ads. If the client wants an ad-free premium feel, the lever is channel monetization settings, not code. Set expectation with client. |
| `cc_load_policy`, `cc_lang_pref`, `hl` work | Player parameters (HIGH) | Pass `hl=ar`/`hl=en` and `cc_lang_pref` from the UI locale so the YouTube chrome and captions follow the site language. Currently not set in `youtube-player.tsx`. |
| Embedding disabled / private / deleted / region-blocked videos fail inside the iframe (error 101/150/100) | IFrame API (HIGH) | Import must check `status.embeddable` and `privacyStatus`; player must show a branded error, and admin needs a "broken episodes" view. |
| Data API key quota default 10,000 units/day; `playlistItems.list` and `videos.list` cost 1 unit, max 50 per page | Data API docs (HIGH for playlistItems; MEDIUM for videos.list from training) | A 50-episode season import is ~2-4 units. Quota is not a concern for import; it is a concern only if viewers' page loads hit the API (never do that). |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these and the product feels broken or untrustworthy.

#### A. Admin: YouTube playlist → season import

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Paste a playlist URL (any form: `youtube.com/playlist?list=`, `watch?v=..&list=`, `youtu.be/..?list=`) and get the list ID | Admins paste whatever their browser shows | LOW | Parse server-side; reject `WL`, `LL`, `HL` and mixes (`RD…`) — the API refuses these (`playlistItemsNotAccessible`). |
| Preview before commit: table of videos with thumbnail, title, duration, position, status | Every CMS import (WordPress, Shopify, Vimeo OTT) shows a dry-run; blind import into a live site is unacceptable | MEDIUM | `playlistItems.list` (paged, 50/page) → `videos.list` (50 IDs/call, `snippet,contentDetails,status`) for ISO-8601 duration, `embeddable`, `privacyStatus`. |
| Per-row include/exclude checkbox; private/deleted/non-embeddable rows auto-unchecked with a reason | Playlists contain "Private video"/"Deleted video" placeholders and trailers | LOW | Deleted/private items return placeholder titles and no usable thumbnail. |
| Episode numbering from playlist position, editable before commit | Playlist order is the season order for the client, but they mis-order sometimes | LOW | Ties into the known "episode reorder" defect — fix reorder first. |
| Title/description taken from YouTube, with AR/EN mapping | Content is bilingual; YouTube has one title per video (plus optional localizations) | MEDIUM | Default: YouTube title → the language detected (Arabic script regex) column; other language left blank and flagged "needs translation". `snippet.localized` / `localizations` part can fill the second language if the channel set it. |
| Thumbnail: use the best available (`maxres` → `standard` → `high`) and copy to R2 | Hotlinking `i.ytimg.com` works but sizes vary and `maxres` 404s on some videos | MEDIUM | Copy on import so artwork follows the R2 media rule. |
| Re-import / sync the same playlist: add new videos, never duplicate, never overwrite admin edits | Seasons grow weekly; admins will paste the same link again | MEDIUM | Unique key `(season_id, youtube_video_id)`. Show "3 new, 12 unchanged, 1 removed from YouTube". Do not auto-delete. |
| New imported episodes land as draft or scheduled, never auto-published | Existing draft/coming-soon/published + broadcast-day scheduling must stay the publish gate | LOW | Offer "schedule on broadcast days" as the last step of the import, reusing the existing bulk scheduler. |
| Single-episode add from a video URL, ID validated server-side (exists, embeddable, public/unlisted) | Not every episode is in a playlist | LOW | Same `videos.list` call. Unlisted videos embed fine and are common for "platform-first" releases. |
| Audit log entry per import (who, playlist, counts) | Two admins; "who added these 40 episodes?" | LOW | Depends on two-admin identity. |
| API key only server-side (Worker secret) | Exposed key gets quota-drained | LOW | Already in Active list. |

#### B. Email OTP sign-in

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Single email field → "Send code" → 6-box code entry screen | Standard pattern (Slack, Notion, Netflix "use a sign-in code") | LOW | Supabase: `signInWithOtp({ email, options: { shouldCreateUser } })` + `verifyOtp({ email, token, type: 'email' })`. Magic link and OTP share one template; including `{{ .Token }}` makes it a code email. |
| Code input: numeric keypad (`inputmode="numeric"`), `autocomplete="one-time-code"`, paste-to-fill all boxes, auto-submit on 6th digit | Mobile users paste from mail notifications; iOS suggests the code | LOW | Boxes must render LTR even in the Arabic UI (digits are LTR). Accept Arabic-Indic digits (٠-٩) and normalize. |
| Resend with visible countdown (60 s) | Supabase rate-limits to one OTP request per 60 s per user | LOW | Show the timer instead of a silent failure. |
| Clear errors: wrong code, expired code, too many attempts | Otherwise users retry forever | LOW | Expiry default 1 h; this setting also governs password-reset and confirmation links, so keep it short (e.g. 10-15 min) deliberately for all. |
| Same account whether user came by password or OTP | Users forget which method they used | LOW | Supabase keys users on email; OTP on an existing password account signs in. |
| Decide sign-up via OTP: `shouldCreateUser` true or false | Sign-up is required for everything; OTP is the lowest-friction sign-up | LOW | Recommend `true` with Turnstile in front, so "enter email → code" is also sign-up. If false, show "No account for this email — create one". Product decision for discuss. |
| Branded code email in the user's language, code in large monospace, plain-text part, no tracking links | Code emails are opened on phones; tracking rewrites hurt deliverability | MEDIUM | Locale must be known before sign-in: pass it in `options.data`/redirect, or render both languages in one email. Supabase templates are single-language; for true EN/AR use the Auth **Send Email Hook** to render via Resend yourself. |
| Turnstile before sending a code | OTP endpoints are an email-bombing vector | LOW | In Active list. |

#### C. Branded transactional email set

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Consistent template: logo, #ffcc00 accent on #0a0a0a or light body, footer with company name (Spacelight Studios FZ LLC), address, support link | Unbranded Supabase defaults look like phishing | MEDIUM | React Email (or plain HTML) rendered in the Worker, sent through Resend. Test dark-mode clients (Gmail app inverts colors). |
| EN and AR versions, AR with `dir="rtl"` and an Arabic-capable font stack | Bilingual audience | MEDIUM | Store `preferred_locale` on the profile; fall back to the locale at sign-up. Webfonts are unreliable in mail — use system Arabic fallbacks (Tahoma/Arial). LBC brand font will not load in most clients. |
| Auth emails: confirm sign-up, OTP code, password reset, email change | Already sent by Supabase today; must move to Resend from `no-reply@clickitstory.ae` | MEDIUM | Custom SMTP in Supabase (simplest) or Send Email Hook (needed for real per-user language). SPF/DKIM/DMARC on clickitstory.ae required first. |
| Welcome email after first verified sign-in | Expected; low value but sets the tone | LOW | Trigger once (flag on profile), not on every sign-in. |
| Support auto-reply to the sender + copy to admins with reply-to = sender | Without auto-reply users resend; without reply-to admins can't answer from mail | LOW | Rate-limited already. Include ticket reference. |
| Newsletter double opt-in confirmation | Proof of consent; protects sender reputation | LOW | Store `confirmed_at`, IP source, timestamp. |
| New-episode alerts for My List shows, opt-in, with one-click unsubscribe | Netflix/Shahid-style "new episode" notice is the main re-engagement loop | MEDIUM-HIGH | See dependencies. Needs: per-user preference, publish event (cron publish), batching (one email per user per day even if 3 episodes drop), idempotency (never twice for the same episode), `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers pointing to a signed, login-free POST endpoint. |
| Preference center: per-category toggles (new episodes, newsletter); auth emails not toggleable | Users expect granular control; auth mail is transactional | LOW-MEDIUM | Profile page section + tokenized public page for the unsubscribe link. |

#### D. Search (shows + episodes, AR + EN)

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Search box reachable from every page (header icon / `/` shortcut), results grouped Shows then Episodes | Every streaming app | LOW | Existing nuqs for `?q=` deep links. |
| Search-as-you-type with debounce (~250 ms), minimum 2 chars | Catalog is tiny; instant results expected | LOW | Server route with cache; 15 shows / ~300 episodes. |
| Matches either language regardless of UI language | Arabic viewers type English show names and vice versa | MEDIUM | One generated `tsvector` combining `simple`/`english` on EN columns and `arabic` on `*_ar` columns (Postgres ships a Snowball `arabic` config). GIN index. |
| Arabic normalization: alef variants (أ إ آ → ا), taa marbuta (ة → ه), alef maqsura (ى → ي), strip tashkeel and tatweel | Arabic users type without hamza/diacritics; without normalization half the searches miss | MEDIUM | Normalize both stored text (generated column via an IMMUTABLE function) and query. The Snowball Arabic stemmer does some of this; do it explicitly anyway. MEDIUM confidence on exact stemmer coverage — test with real titles. |
| Typo/partial tolerance (prefix match, trigram) | "Short catalog, no results" feels broken | MEDIUM | `pg_trgm` similarity as fallback when FTS returns nothing; prefix `:*` on the last token. |
| Empty state with suggestions (popular shows, categories) | Never a blank page | LOW | |
| Respect draft/scheduled state and auth gate | Search must not leak unpublished episodes | LOW | Query through RLS-respecting view or filter `published`. |

#### E. Full Arabic UI with correct RTL

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| `<html lang="ar" dir="rtl">` per locale; layout mirrors (nav, rails scroll origin, drawers, breadcrumbs) | Arabic users notice broken mirroring instantly | MEDIUM | Tailwind v4 logical utilities (`ms-/me-/ps-/pe-/start-/end-`) everywhere; audit `left-/right-/ml-/mr-/pl-/pr-/text-left`. |
| Carousels (Embla) run RTL: `direction: 'rtl'` option, arrows swapped | Rails scrolling the wrong way is the most common RTL bug | LOW-MEDIUM | Embla supports `direction: 'rtl'`. |
| Directional icons flipped (chevrons, back arrows, "next episode"); non-directional icons not flipped (play, search, clock) | Standard RTL guidance (Material, Apple HIG) | LOW | `rtl:-scale-x-100` on a known list. Media play triangle does **not** flip. |
| Numbers, durations, timestamps, episode codes (S1 E3) isolated LTR with `<bdi>`/`dir="auto"` | Mixed bidi text scrambles "S1 E3" and times | LOW | Choose Western vs Arabic-Indic digits once (UAE sites mostly use Western). |
| Arabic typography: a real Arabic font (LBC has no Arabic glyphs likely — verify), larger line-height, no letter-spacing/uppercase on Arabic | Latin tracking/uppercase breaks Arabic joining | MEDIUM | Brand font gap: needs a chosen Arabic face (e.g. IBM Plex Sans Arabic / Noto Kufi Arabic). Design decision for Koss. |
| Content language fallback: show `*_ar` if present else EN, never empty | Not every episode will be translated on day one | LOW | Admin "missing translation" indicators. |
| Locale switcher that keeps the current page; locale remembered | Expected | LOW | next-intl handles routing. |
| Admin stays usable in both, but admin can stay EN-first | Admins are bilingual operators | LOW | Don't spend RTL effort on admin first; viewer surfaces first. |
| Player chrome language follows site (`hl`) | Mixed-language player looks unfinished | LOW | One param. |

#### F. Reviews with real names and edit

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Display name + avatar on each review (not "Anonymous"/email) | Social proof needs a person | LOW | Display name from profile; never show email. Fallback initials avatar. |
| One review per user per show; edit and delete own review; "edited" marker with date | Universal (App Store, IMDb, Google) | LOW | Unique `(user_id, show_id)`; RLS `user_id = auth.uid()` for update/delete. |
| Star or thumbs rating + optional text; average shown on show page | Expected for "reviews" | LOW | Already exists partially — confirm. |
| Admin moderation: hide/restore, with audit | UGC on a brand site must be removable | LOW | Admin `reviews` route exists. Hidden ≠ deleted. |
| Profanity/length limits, rate limit | Basic abuse control | LOW | |

#### G. Two-admin ops with audit

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Each admin has their own login (no shared account) | Accountability; the audit log is meaningless with a shared login | LOW | `admins` table keyed by `auth.users.id`; `is_admin()` SQL function used by RLS and server actions. |
| Audit log records actor, action, entity, before/after diff, timestamp (Dubai time display) | "Who unpublished this?" | MEDIUM | Existing audit log — add actor and diff. Writes happen with service role, so actor must be passed explicitly, not inferred from `auth.uid()`. |
| Audit log filter by admin, entity, date | Usable log | LOW | |
| Admin sign-in hardened: strong password + OTP or TOTP MFA | Admin accounts are the real attack surface | MEDIUM | Supabase supports TOTP MFA (`aal2`). Recommend requiring aal2 for `/admin`. Decision for discuss. |
| Concurrent-edit safety (last-write warning) | Two admins editing the same show | MEDIUM | `updated_at` optimistic check: "Nejib changed this 2 min ago — reload". Cheap and prevents silent overwrite. |
| Add/remove admin is an owner-gated step, not a UI button | Two equal admins only; no RBAC | LOW | SQL/numbered step, not a self-serve UI. |

#### H. Support inbox with statuses

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Status per message: New → Open → Resolved (plus Spam) | Minimum helpdesk; current status control is dead (Active list) | LOW | Enum column + audit entry on change. |
| Unread/new count badge in admin nav | Admins need to notice new messages | LOW | |
| Assignee (Issam / Nejib / none) | Two admins must not both answer | LOW | Depends on two-admin identity. |
| Reply via email client (mailto with reply-to set) rather than in-app composer | In-app reply needs inbound mail handling | LOW | Auto-reply + admin copy handle the loop. |
| Filters by status, search by email | Basic | LOW | |
| Internal note per message | "Called him, resolved" | LOW | Optional. |

#### I. Viewer playback expectations on a YouTube-backed product

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Resume per episode (switching episodes restores each one's position) | Core value; in Active list | LOW-MEDIUM | `seekTo(saved)` on `onReady`, guard against seeking to the last 5% (treat as finished). Save on pause, every ~10 s, on `visibilitychange`/`pagehide`, and before switching. |
| Autoplay next with visible countdown and cancel | Netflix norm; already exists | — | Must comply with no-overlay rule (see section 0). |
| Mark watched at ~90-95% and progress bars on cards | Exists | — | |
| Mobile: `playsinline`, fullscreen works, landscape | Exists (`playsinline: 1`) | — | |
| Keyboard: space/arrow keys work | YouTube iframe handles when focused | LOW | Don't steal focus. |
| Captions in viewer's language if uploaded on YouTube | Arabic/English audience | LOW | `cc_lang_pref` param. Captions authored on YouTube, not CIT. |
| Graceful "this video is unavailable" state with link back to the show | Embeds break when a video goes private | LOW | Map IFrame error codes 2/5/100/101/150 to branded messages; log to admin "broken episodes". |
| Fast first frame: poster first, iframe loads on click (catalog) | Iframes cost ~500 KB+ each | — | Already planned (lite embed on catalog, IFrame API on watch). |

---

### Differentiators (Competitive Advantage)

Aligned with Core Value: "watch immediately, progress remembered; admin puts a whole season up from one link."

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| One-link season import with sync ("check for new episodes" button per season) | Turns weekly publishing into one paste; most YouTube-catalog sites require per-episode entry | MEDIUM | Reuses import diff. Optional later: cron-driven auto-sync into draft. |
| Import → schedule in one flow (map new episodes onto broadcast days) | Connects the YouTube upload habit to CIT's broadcast rhythm | LOW (exists separately) | Join two existing pieces. |
| New-episode alerts batched as a daily digest at a set Dubai time | Feels editorial, not spammy; aligns with broadcast days | MEDIUM | Runs after the publish cron. |
| Bilingual search that "just works" across scripts | Arabic normalization is rare on small platforms and noticed by Arabic users | MEDIUM | Section D. |
| Branded pre-play poster + CIT title card outside the player, YouTube chrome only after click | Hides "this is a YouTube channel" feeling legally | LOW | Poster is not over the player — it replaces it until click. |
| "Broken episode" monitor in admin (nightly `videos.list` over all episode IDs: private/deleted/non-embeddable) | Catches embeds that silently die; ~300 IDs = 6 units/day | LOW-MEDIUM | Cron Trigger; email admins on change. |
| Arabic-first email + UI quality (correct RTL, Arabic type) | Most GCC small platforms ship half-mirrored Arabic | MEDIUM | |
| Admin concurrency warning + diffed audit log | Two-admin team confidence | MEDIUM | |
| Continue-watching across devices (already DB-backed) promoted in emails ("Pick up where you left off") | Re-engagement | LOW | Future email type; do not build now. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Custom player controls/skin over the YouTube iframe | "Netflix look" | Violates RMF (no overlays, no player modification); risks API access revocation | Style everything around the player; use YouTube controls. |
| Hiding the YouTube logo / title bar / related videos via CSS cropping or scaling | Brand purity | Prohibited modification; `modestbranding`/`showinfo` are dead | Click-to-load poster; accept YouTube chrome after play. |
| Hover-to-preview that starts YouTube playback on cards | Netflix hover trailers | RMF forbids mouseover-initiated actions; also multiple autoplay players | Short MP4 teasers on R2, or static artwork. |
| Removing or inserting ads | Premium feel / revenue | CIT has no control; ad insertion around embeds violates terms | Client decides channel monetization. |
| Downloads / offline viewing | Streaming norm | Impossible and prohibited with YouTube embeds | None. |
| In-app quality selector | Streaming norm | YouTube ignores programmatic quality requests | YouTube gear menu. |
| Fetching YouTube data on viewer page loads | "Always fresh" titles/thumbnails | Burns quota, adds latency, leaks key risk | Import-time copy into Supabase/R2 + nightly health check. |
| Auto-publishing straight from playlist sync | "Fully automatic" | Unreviewed titles/thumbnails go live; bypasses scheduling | Sync into draft; admin publishes or schedules. |
| Auto-deleting episodes that vanished from the playlist | Keep in sync | One YouTube mistake wipes a season and its viewer progress | Flag "removed from YouTube"; admin decides. |
| Machine-translating titles/descriptions on import | Fill AR/EN gap fast | Bad Arabic on a brand site; client produces bilingual content | Flag missing translation; admin fills. |
| In-app support chat / full helpdesk (threads, SLA, macros) | "Real support" | Two admins, low volume; inbound email parsing adds DNS/MX work | Status + assignee + email reply. |
| Role-based admin permissions | "Future-proof" | Out of scope by decision; doubles RLS surface | Two equal admins via `admins` table. |
| Public review replies/threads, likes on reviews | Engagement | Moderation load for two admins | Single review per user, admin hide. |
| SMS/WhatsApp OTP | GCC users like WhatsApp | Cost, Twilio/provider setup, UAE sender registration | Email OTP now; revisit later. |
| Magic link *and* code in the same email | "Give both" | Link opens in a different browser/app (mail in-app browser) and signs in there, not where the user is waiting; confuses PKCE flow | Code only for OTP sign-in; links only for reset/confirm. |
| Push / web-push notifications | Re-engagement | Permission prompts, service worker, iOS limits | Email alerts first. |
| Marketing emails to all users without opt-in | Growth | UAE PDPL consent expectations; Gmail/Yahoo bulk rules; brand risk | Opt-in newsletter (double opt-in) + opt-in alerts. |
| Elasticsearch/Algolia/Meilisearch | "Better search" | ~300 rows; sync burden, cost | Postgres FTS + trigram. |

---

## Feature Dependencies

```
Cloudflare Worker secrets
    └──requires──> YouTube API key server-side
                       └──requires──> Single-episode add (server-validated ID)
                       └──requires──> Playlist import (preview → commit)
                                          ├──requires──> Episode reorder fix (known defect)
                                          ├──requires──> R2 media pipeline (thumbnail copy)
                                          ├──enhances──> Bulk scheduling (existing)
                                          └──enhances──> Broken-episode monitor (Cron Trigger)

clickitstory.ae DNS on Cloudflare
    └──requires──> Resend domain verified (SPF, DKIM, DMARC)
                       └──requires──> Branded email templates (EN + AR)
                                          ├──requires──> Auth emails via Resend (custom SMTP or Send Email Hook)
                                          │                  └──requires──> Email OTP sign-in
                                          ├──requires──> Welcome / support auto-reply / newsletter confirm
                                          └──requires──> New-episode alerts
                                                             ├──requires──> Profile preferred_locale + notification prefs
                                                             ├──requires──> Signed one-click unsubscribe endpoint
                                                             ├──requires──> Publish cron on Cron Triggers (event source)
                                                             └──requires──> My List (existing)

Turnstile ──protects──> OTP send, sign-up, contact, newsletter

admins table + is_admin()
    ├──requires──> Audit log actor + diff
    │                  └──enhances──> Import audit, inbox status audit, review moderation audit
    ├──requires──> Inbox assignee
    └──enhances──> Concurrency warning

Arabic normalization function (IMMUTABLE)
    └──requires──> Search tsvector generated columns + GIN
                       └──enhances──> Search UI (header, ?q= deep link)

RTL logical-property audit + Arabic font decision
    └──requires──> Full Arabic UI
                       └──enhances──> Arabic email templates (same type decisions)

Profile display name
    └──requires──> Reviews with real names / edit

No-overlay rule ──conflicts──> current AutoplayOverlay (inset-0 over player)
Hover preview ──conflicts──> RMF mouseover rule
```

### Dependency Notes

- **Playlist import requires the reorder fix:** import writes positions in bulk; a broken reorder corrupts every imported season.
- **All email requires DNS + Resend verification:** nothing branded can ship before SPF/DKIM/DMARC on clickitstory.ae; this sits behind the nameserver move.
- **Per-language auth email requires the Send Email Hook (or both languages in one email):** Supabase dashboard templates are one per type, not per user language. MEDIUM confidence — verify the hook payload exposes user metadata for locale.
- **OTP expiry is shared with reset/confirm links:** changing it for OTP changes all auth links.
- **New-episode alerts require the publish cron to emit an event:** today the cron flips status; alerts need a record of "published at" per episode to batch and dedupe.
- **Audit actor requires passing identity explicitly:** service-role writes have no `auth.uid()`.
- **Arabic email and Arabic UI share the font decision:** decide once.
- **Autoplay-next overlay conflicts with RMF:** move it outside the player box or unmount/hide the iframe at `ENDED` before showing it.

---

## MVP Definition (this milestone)

### Launch With

- [ ] Playlist import with preview, include/exclude, status checks, dedupe, lands as draft — Core Value
- [ ] Single-episode add with server validation — Core Value
- [ ] Per-episode resume on switch — Core Value
- [ ] Player compliance pass: no overlay on iframe, `hl`/`cc_lang_pref` from locale, branded error states — legal and Core Value
- [ ] Email OTP sign-in (code-only email, paste/auto-fill, resend timer, Turnstile) — Active
- [ ] Auth emails via Resend, branded EN + AR — Active
- [ ] Welcome, support auto-reply + admin copy, newsletter double opt-in — Active
- [ ] New-episode alerts for My List, opt-in, batched daily, one-click unsubscribe headers — Active
- [ ] Two admin accounts, audit with actor — Active
- [ ] Inbox statuses (New/Open/Resolved/Spam) + assignee — Active (dead control today)
- [ ] Search AR + EN with Arabic normalization, shows + episodes — Active
- [ ] Full RTL viewer UI + Arabic font — Active
- [ ] Reviews with display names, edit/delete own — Active

### Add After Validation

- [ ] "Check for new episodes" sync button per season — once first imports are used weekly
- [ ] Broken-episode nightly monitor — once catalog passes ~100 episodes
- [ ] Audit diff (before/after) and concurrency warning — once both admins edit daily
- [ ] Admin TOTP MFA — recommended; can follow launch if discuss decides
- [ ] Trigram typo tolerance — if search logs show misses

### Future Consideration

- [ ] Auto-sync playlists into draft on a cron — after manual sync proves reliable
- [ ] WhatsApp/SMS OTP, Google/Apple sign-in — explicitly out of scope now
- [ ] "Continue watching" re-engagement emails — after alert deliverability is proven
- [ ] Web push — after email loop proves value

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Playlist → season import (preview, dedupe, draft) | HIGH (admin) | MEDIUM | P1 |
| Single-episode add, validated | HIGH (admin) | LOW | P1 |
| Per-episode resume on switch | HIGH | LOW | P1 |
| Player RMF compliance (overlay, hl, errors) | HIGH (risk) | LOW | P1 |
| Email OTP sign-in | HIGH | LOW-MEDIUM | P1 |
| Branded auth email via Resend, EN+AR | HIGH | MEDIUM | P1 |
| Welcome / support auto-reply / newsletter confirm | MEDIUM | LOW | P1 |
| New-episode alerts + one-click unsubscribe | HIGH | MEDIUM-HIGH | P1 |
| Two admins + audit actor | HIGH (ops) | LOW | P1 |
| Inbox statuses + assignee | MEDIUM | LOW | P1 |
| AR+EN search with normalization | HIGH | MEDIUM | P1 |
| Full RTL + Arabic font | HIGH | MEDIUM-HIGH | P1 |
| Reviews: names + edit | MEDIUM | LOW | P1 |
| Season sync button | MEDIUM | LOW (after import) | P2 |
| Broken-episode monitor | MEDIUM | LOW-MEDIUM | P2 |
| Audit diff + concurrency warning | MEDIUM | MEDIUM | P2 |
| Admin TOTP MFA | MEDIUM (security) | MEDIUM | P2 |
| Trigram fuzzy search | LOW-MEDIUM | LOW | P2 |
| Auto-sync cron | LOW | MEDIUM | P3 |

---

## Competitor Feature Analysis

LOW-MEDIUM confidence: based on product knowledge, not a fresh audit of each app.

| Feature | Shahid / OSN+ (GCC SVOD, self-hosted) | YouTube-catalog sites (e.g. channel-branded "TV" sites, Vimeo OTT-style YouTube fronts) | CIT approach |
|---|---|---|---|
| Player | Custom player, quality picker, downloads | YouTube iframe, YouTube chrome | YouTube iframe, branded poster before click, everything else around the player |
| Arabic UI | Full RTL, Arabic-first | Often English-only or half-mirrored | Full RTL + Arabic font, AR/EN content fallback |
| Search | Bilingual, fuzzy | Often none or title-only | Postgres FTS AR+EN with normalization |
| Sign-in | Email/password, phone OTP, social | Often none (public) | Email/password + email OTP, sign-up required |
| New-episode notice | Push + email | Rare (relies on YouTube subscribe bell) | Opt-in email digest for My List |
| Content ops | Large CMS teams | Manual per-video entry | One-link playlist import + broadcast-day scheduling |
| Resume / continue watching | Yes | Rarely (YouTube remembers only on youtube.com) | DB-backed per-episode resume |

---

## Open Questions for Discuss

1. OTP as sign-up path (`shouldCreateUser: true`) or sign-in only?
2. Arabic typeface for UI and email (LBC likely has no Arabic glyphs — verify `src/fonts/lbc-*.woff2`).
3. Western vs Arabic-Indic digits in the Arabic UI.
4. Alerts cadence: per-episode or daily digest (recommend digest at a fixed Dubai time after publish cron).
5. Admin MFA required for `/admin` at launch?
6. Does the client's YouTube channel run ads? (sets expectation; not code)

---

## Sources

- YouTube API Services — Required Minimum Functionality: https://developers.google.com/youtube/terms/required-minimum-functionality (HIGH)
- YouTube embedded player parameters (modestbranding, rel, showinfo, hl, cc_lang_pref): https://developers.google.com/youtube/player_parameters (HIGH)
- YouTube Data API `playlistItems.list` (1 unit, 50 max, inaccessible playlists): https://developers.google.com/youtube/v3/docs/playlistItems/list (HIGH)
- YouTube IFrame Player API reference: https://developers.google.com/youtube/iframe_api_reference (HIGH, via project STACK)
- Supabase passwordless email (OTP, `{{ .Token }}`, 60 s limit, 1 h expiry shared with other links): https://supabase.com/docs/guides/auth/auth-email-passwordless (HIGH)
- PostgreSQL Snowball stemmer sync adding Arabic: https://www.postgresql.org/message-id/E1g4YQa-0003tf-Gr@gemulon.postgresql.org (MEDIUM)
- RFC 8058 one-click unsubscribe / Gmail-Yahoo bulk sender rules: https://www.valimail.com/blog/one-click-unsubscribe/ , https://www.mailgun.com/state-of-email-deliverability/chapter/yahoogle-bulk-senders/ (MEDIUM)
- Codebase: `src/components/watch/youtube-player.tsx` (playerVars: rel 0, playsinline, iv_load_policy 3; no hl/cc_lang_pref), `src/components/watch/autoplay-overlay.tsx` (absolute inset-0 over player area)
- Training data (LOW-MEDIUM): `videos.list` cost/fields, `setPlaybackQuality` no-op, Supabase Send Email Hook and TOTP MFA, RTL icon conventions, GCC competitor features

---
*Feature research for: YouTube-backed bilingual streaming platform (Clickit Story)*
*Researched: 2026-10-04*
