# Clickit Story (CIT)

## What This Is

A Netflix-style streaming platform for Clickit Story, a UAE digital media company (Spacelight Studios FZ LLC, Abu Dhabi) with 15 original programs. Viewers sign up, discover a show, pick an episode and watch it through an embedded YouTube player; two admins (Issam Dridi, Nejib Challakhi) upload to YouTube and connect episodes to the platform. This milestone takes the live app off Vercel onto Cloudflare + Supabase and finishes it for production.

## Core Value

A signed-in viewer opens a show and an episode from YouTube plays immediately, with progress remembered — and the admin can put a whole YouTube season on the platform from one playlist link.

## Requirements

### Validated

<!-- Existing in the live app (www.clickitstory.ae), confirmed by the 2026-10-04 map. -->

- ✓ Show / season / episode catalog with draft, coming-soon and published states — existing
- ✓ YouTube IFrame player with resume, 95% complete, 8s autoplay-next across seasons — existing
- ✓ Watch progress, continue-watching rail, watchlist (My List), likes — existing
- ✓ Email + password sign-up, sign-in, password reset, email/password change — existing
- ✓ Profile with avatar, history, saved and liked lists — existing
- ✓ Admin CRUD for shows, seasons, episodes, categories, shorts, cast, artwork, hero/preloader video — existing
- ✓ Bulk episode scheduling over broadcast days (Dubai time) + daily publish cron — existing
- ✓ Site settings: metadata, auth page, footer, portfolio, ticker, live stream URL, legal pages, FAQs — existing
- ✓ Bilingual content columns (*_ar) and en/ar UI message catalogs (1,436 keys each) — existing
- ✓ Support contact + newsletter forms with rate limits, sent via Resend — existing
- ✓ Admin audit log; RLS on every table; service-role admin writes — existing

### Active

**Platform move**
- [ ] App runs on Cloudflare Workers (OpenNext) in the ClickitStory account, served at www.clickitstory.ae
- [ ] clickitstory.ae DNS on Cloudflare; Vercel fully removed (config, packages, BotID, env fallbacks)
- [ ] Page cache and revalidation keep working (R2 incremental cache, D1 tag cache)
- [ ] Scheduled publish and media cleanup run on Cron Triggers
- [ ] Turnstile protects sign-in, sign-up, contact, newsletter
- [ ] Cloudflare Web Analytics replaces Vercel analytics
- [ ] CI on GitHub Actions: lint, typecheck, unit tests, build on every PR; deploy to Cloudflare from main after Ship

**Media**
- [ ] Every photo and video is stored on R2 and served from a media domain; DB holds R2 URLs
- [ ] Admin uploads go straight to R2 (no 55MB server-action bodies); images processed without sharp
- [ ] Existing 86 Supabase Storage objects moved to R2, URLs rewritten, Supabase Storage emptied after proof
- [ ] Hero background videos are compressed MP4 on R2

**YouTube**
- [ ] Admin imports a season from a YouTube playlist link (title, description, thumbnail, duration per video)
- [ ] Admin adds a single episode from a YouTube link; IDs validated on the server
- [ ] YouTube API key lives in a Worker secret, old key rotated
- [ ] Switching episodes resumes each episode's saved position

**Auth and email**
- [ ] Sign-up required for everything except the landing page (and legal pages)
- [ ] Viewer can sign in with a 6-digit email code as well as email + password
- [ ] All auth emails sent through Resend from `Clickit Story <no-reply@clickitstory.ae>`, branded, EN + AR
- [ ] Welcome email, new-episode alerts for My List shows (with unsubscribe), support auto-reply + admin copy, newsletter confirmation
- [ ] Two admins with their own accounts; audit log shows who did what

**Product completeness**
- [ ] Every shown control works: genres-grid / CTA / FAQ toggles, CTA copy and genre color editors, season delete, inbox status
- [ ] Search across shows and episodes in English and Arabic
- [ ] Full Arabic UI with correct RTL
- [ ] Reviews show real names; a viewer can edit their own review
- [ ] Shorts rail and overlay kept and working
- [ ] Placeholder data (picsum posters, test YouTube IDs, fake cast) removed from production after Koss approves the list

**Design system**
- [ ] DESIGN.md and /design-system match the live look (LBC, #ffcc00, #0a0a0a, 8px radius); stale indigo-era values removed
- [ ] One token set: no hard-coded hex or arbitrary radii outside tokens; one brand-color map
- [ ] Design-system canvas in Claude Design covering foundations, viewer screens, admin screens, email templates

**Hardening**
- [ ] Known defects fixed: episode reorder, broadcast-day validation, /legal gating, schema drift vs migrations, destructive first migration, SVG sanitizer, CSP, rate limiter IP source, cron secret compare
- [ ] E2E tests cover sign-in, browse, watch, admin import; dead code removed

### Out of Scope

- Self-hosted video / Cloudflare Stream — YouTube embed only (client constraint)
- Vercel (any plan) — moving off it; Pro upgrade not wanted
- Moving the catalog or auth to D1 — Supabase stays system of record; D1 only for cache tags and rate limits
- Google / Apple sign-in — not chosen for this milestone
- Staging environment — Koss chose a straight cutover
- Paid subscriptions / payments — not part of the product now
- Role-based editor/admin split — two equal admins only

## Context

- Live: https://www.clickitstory.ae on Vercel (team `clickit-s-projects`, Hobby); deploys stay BLOCKED because pushes come from GitHub user Loomlyne, not a team member.
- Repo: github.com/Loomlyne/Clickit (public) is the home. ~800 commits.
- Supabase `lajguozmtissnnfccmej` (ap-southeast-1) ACTIVE: 15 shows, 13 seasons, 39 episodes (~294 planned), 9 shorts, 15 categories, 3 users, 86 storage objects. Advisors: anon-callable SECURITY DEFINER `get_public_youtube_video_id`, leaked-password protection off.
- Cloudflare account "ClickitStory" `e329b099b6e4272fc0915a99832e47fe` (new, empty). Wrangler only via `HOME=/Users/koss/.clickit-cloudflare`; cf CLI profile `clickit`.
- DNS registrar tasjeel.ae; no MX/TXT records yet.
- Resend: Koss's existing account; clickitstory.ae to be added and verified.
- A half-built R2 mirror exists (`src/lib/r2-media-core.ts`, `scripts/migrate-supabase-media-to-r2.mjs`, flag `NEXT_PUBLIC_MEDIA_CUTOVER_READY`) — never switched on.
- Code facts from the map: `src/app/[locale]/admin/actions.ts` is 4,230 lines; 26+ unstable_cache calls; `src/proxy.ts` gates routes; 60 migrations, some seed fake data into production; Playwright specs stale.
- Design in code: LBC font only (`src/fonts/lbc-*.woff2`), `#ffcc00` accent, 86 hard-coded hex values, 5 indigo hover leftovers. No brand guideline PDF or brand fonts in hand.

## Constraints

- **Stack**: Next.js 16 App Router + Supabase (auth + Postgres) + Tailwind v4, hosted on Cloudflare Workers — client and Koss's standard stack
- **Video**: YouTube embed only — no video hosting cost or infrastructure
- **Data safety**: never wipe the live Supabase DB; live DB writes, DNS, secrets, emails to real people are owner-gated, one numbered step each
- **Process**: Koss signs discuss, plan, UAT and ship; this session is the control session (only one that commits to main and deploys)
- **Accounts**: Cloudflare work only in the ClickitStory account; never the default (Vamos) wrangler login
- **Cost**: free tiers first; any paid Cloudflare feature (Images) priced and agreed with Koss before enabling
- **Timeline**: no fixed date — order by risk

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cloudflare Workers via OpenNext, ClickitStory account | Vercel deploys blocked; Koss's default stack is Cloudflare | — Pending |
| Nameservers move to Cloudflare | One place for Worker domain, R2 domain, Resend DNS, Turnstile | — Pending |
| Supabase stays system of record; D1 for cache tags + rate limits | No data split, keep RLS | — Pending |
| R2 only for media, Supabase Storage emptied | All media on Cloudflare | — Pending |
| Playlist-per-season YouTube import + single link | Matches how the client publishes seasons | — Pending |
| Sign-up required for everything except landing | Koss's choice | — Pending |
| Email+password and email OTP; Resend from Koss's account, no-reply@clickitstory.ae | Branded, reliable auth email | — Pending |
| Two equal admins (admins table) | Issam and Nejib both run content | — Pending |
| Design truth = live look (LBC + #ffcc00) | No brand guideline files available | — Pending |
| Canvas in Claude Design | Koss's choice | — Pending |
| Straight cutover, no staging | Koss's choice | — Pending |
| GitHub Actions for CI + deploy | Free on a public repo, gates before deploy | — Pending |
| Wire every dead control rather than remove | Koss's rule: shown controls must be live | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-04 after initialization*
