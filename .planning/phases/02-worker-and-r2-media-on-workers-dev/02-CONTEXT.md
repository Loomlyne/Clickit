# Phase 2: Worker and R2 Media on workers.dev - Context

**Gathered:** 2026-10-19 (decisions D-01 to D-04 signed by Koss), 2026-10-20 (D-05)
**Status:** Ready for planning
**Session:** work session `phase-02-workers-r2` (worktree `.claude/worktrees/phase-02-workers-r2-0db863`). Planning only. The control session in `/Users/koss/Developer/Clickit` commits to main, deploys, and talks to Koss.

<domain>
## Phase Boundary

Port the live Next.js 16 + Supabase app from Vercel to Cloudflare Workers (OpenNext) in the ClickitStory Cloudflare account, prove it on its `workers.dev` URL, and move every image and video to R2, optimized. Supabase stays the system of record. Nothing in this phase changes what www.clickitstory.ae serves: DNS, the www cutover, the database URL rewrite and the Vercel project deletion come after the Worker is proven (Phase 3 path, see D-05 and the proposed roadmap edits below).

In scope: Next 16.4.x upgrade (OpenNext 1.20.12 floor is Next >=16.4.1, per research 2026-10-20), OpenNext build and `workers.dev` deploy, R2 buckets (media + Next cache), D1 tag cache, Durable Object revalidation queue, optimized media copy script (dry-run first, idempotent, checksum report), Worker media route, direct-to-R2 admin uploads, Cron Trigger wiring (deployed off until cutover), Turnstile on forms, Cloudflare Web Analytics, rate limits on `CF-Connecting-IP`, removal of Vercel-only code (BotID, Vercel analytics and speed insights, `vercel.json`, `check-cron.sh`, `.vercelignore`, Vercel CSP hosts), per-route CPU measurement on Workers Free, a cutover runbook with every owner step numbered.

Out of scope here: NS change at tasjeel and DNS records (Phase 3 path), rewriting media URLs in live database rows (needs Koss's live-DB approval), switching www to the Worker, deleting the Vercel project, email queue and Resend app emails (Phase 5), YouTube import (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Signed by Koss 2026-10-19 (do not re-ask)

- **D-01 Order:** Phase 01.1 (admin actions hardening, branch `phase-01.1-admin-actions-hardening-inserted`, at UAT now) finishes and lands on main first. Phase 2 is planned in parallel and executes only after 01.1 has landed. The Phase 2 execution branch is cut from the `main` that carries 01.1, because both phases touch the upload paths in `src/app/[locale]/admin/actions.ts`.
- **D-02 Workers Free first:** build and run on Workers Free. Measure CPU ms per route on `workers.dev` and record it. Workers Paid ($5/month) comes back to Koss as a priced question only if Free fails, with the measured numbers. No paid feature (Workers Paid, Images Paid, Image Transformations beyond free, R2 beyond free) is enabled without his priced OK.
- **D-03 Images (Koss: "all images must transfered to r2 now if possible and optimized"):** every image (and hero/preloader video) moves to R2 in this phase, optimized.
  - Optimize at copy time, locally, with `sharp` in a Node script (WebP and AVIF variants plus the untouched original). Cloudflare Image Transformations need the zone on Cloudflare and are a paid-tier risk, so they are not used.
  - Serve from R2 through a Worker R2 binding on `workers.dev` until the `media.clickitstory.ae` custom domain exists (needs the zone, Phase 3 path).
  - Never set `NEXT_PUBLIC_MEDIA_CUTOVER_READY=verified` in any build until the media host serves every file in the copy report (live images are broken today because a Vercel build points at `media.clickitstory.ae`, which has no DNS; the files are safe on Supabase Storage project `lajguozmtissnnfccmej`).
  - Database rows are not rewritten in this phase. Any live-DB write needs Koss's approval as one numbered step.
- **D-04 Deploys:** local wrangler only. No GitHub Actions deploy token, no Workers Builds. Every wrangler command runs with `HOME=/Users/koss/.clickit-cloudflare`, and `wrangler whoami` must show the ClickitStory account (`e329b099…`) before it. Never the default (Vamos) login. `wrangler.jsonc` pins `account_id`.

### Signed by Koss 2026-10-20

- **D-05 Goal:** "remove deployment from Vercel, move it to Cloudflare with the images." Vercel removal happens at the END, after the Cloudflare site is proven live on www. The roadmap today splits this across phases (PLAT-10 in Phase 8, the DNS move in Phase 1). The edits that make it one path are proposed below for Koss to sign; nothing is moved silently.

### Facts (checked 2026-10-19/20)

- www.clickitstory.ae is still served by Vercel (checked 2026-10-19 23:09 CET). Vercel deploys are BLOCKED (git author not on the Hobby team), so no code reaches www until the Worker serves it.
- Zone NS are `ns3/ns4.tasjeel.ae`, not Cloudflare. The www and media cutover needs an owner NS change at tasjeel. The stray Cloudflare NS pair (`ignat`/`nataly`) must be resolved before that (SAFE-05).
- Draft PR Loomlyne/Clickit#16 (branch `fix/images-unoptimized-supabase-host`: `images.unoptimized`, Supabase host from env, parked by Koss "until the Cloudflare move") is based on an older main and is input to this phase: its env-derived Supabase host is reused; `unoptimized: true` is superseded by the R2 variant loader (D-03).
- `npm run gate:local` = lint + unit tests + build. There is no CI workflow except `supabase-migrations.yml` (SAFE-03 not done yet).
- `vercel.json` crons: `0 4 * * 1` cleanup-media, `0 1 * * *` publish-scheduled.

### Derived for this phase (Claude's discretion, recorded so plans follow one line)

- **Separate media Worker.** A tiny Worker `clickit-media` with only the `MEDIA` R2 binding serves `GET/HEAD /<bucket>/<key>` with Range, `ETag`, long `Cache-Control`, `nosniff`, and a restrictive CSP on SVG. It gets its own `workers.dev` origin, which fits `getPublicMediaOrigin()` (origin only, path `/`) and keeps the existing `bucket/key` layout, so the later switch to the R2 custom domain `media.clickitstory.ae` is an env change, not a code change. It also keeps media requests out of the Next Worker's CPU.
- **Variants and loader (refined by research 2026-10-20).** One URL per image: `<media-origin>/<bucket>/<key>?w=<width>`. The copy script stores WebP and AVIF variants at fixed widths (640, 1280, 1920; never upscaled) under a variant prefix next to the untouched original. The media Worker picks AVIF or WebP from the `Accept` header (`Vary: Accept`) and falls back to the original whenever a variant is missing, so an image is never broken. A custom `next/image` loader adds `?w=` (nearest width) for media-origin URLs; YouTube and local paths pass through unchanged. The original fallback is permanent (Safari cannot encode WebP from canvas, so Safari admin uploads have no variants).
- **New uploads.** `sharp` cannot run on Workers. Admin uploads go browser → presigned PUT → R2 (aws4fetch in the Worker, R2 token scoped to the media bucket) → finalize (`MEDIA.head`, prefix and type check) → DB write. Variants for new uploads are made in the browser where the browser can encode WebP (canvas → WebP at the same widths) and uploaded with the original; AVIF only comes from the copy script. Presigned PUT cannot cap size or type, so finalize checks `MEDIA.head` size, magic bytes and key prefix, and deletes a bad object. SVG stays rejected (Phase 1.1 D-03).
- **Crons ship off.** The `scheduled()` handler and the `/api/cron/*` routes are wired and tested locally (`wrangler dev --test-scheduled`), but `triggers.crons` stays empty on the `workers.dev` deploy, because Vercel's crons still run against the same live Supabase. They are turned on at cutover, after Koss switches the Vercel crons off.
- **Supabase CAPTCHA stays off in this phase.** Supabase CAPTCHA is project-wide; turning it on would break sign-in on the live Vercel site, which sends no token. The Turnstile widget and token passing ship now; Koss enables Supabase CAPTCHA at cutover. Contact and newsletter verify their own token with siteverify now.
- **UAT split.** Write paths (uploads, admin edits, crons) are UAT'd on `opennextjs-cloudflare preview` (workerd) against a local Supabase stack. The `workers.dev` deploy talks to live Supabase, so UAT there is read paths, sign-in, and at most one owner-approved write on a draft test show.
- **Media Worker request budget.** On Workers Free every media request counts toward the account's 100k requests/day. Fine at today's traffic; it goes away when the R2 custom domain serves media in Phase 3. Recorded in the CPU/limits report.

### Claude's Discretion

File layout under `src/server/*`, variant key naming, exact widths and quality, loader implementation, how CPU ms are collected (Workers Logs / `wrangler tail`), test structure, and the exact wording of runbook steps, all inside the decisions above.

</decisions>

<proposed_roadmap_changes>
## Proposed ROADMAP / REQUIREMENTS edits (for Koss to sign; NOT applied)

One path: Phase 2 proves the Worker and R2 media on workers.dev → Phase 3 moves the zone, media domain and www, rewrites the DB URLs, holds the proof window, then deletes Vercel.

1. **PLAT-10 split.** Code-side Vercel removal (`vercel.json`, `@vercel/*`, `botid`, `VERCEL_*` fallbacks, `.vercelignore`, `check-cron.sh`, Vercel CSP hosts) moves into Phase 2 (it is already PLAT-05/06 work). Deleting the Vercel project and its domain moves from Phase 8 to the last step of Phase 3, after Koss closes the proof window. Phase 8 criterion 2 keeps only "no Vercel artefact remains" as a check; criterion 4 loses "Vercel project is deleted".
2. **DNS-01 (and MAIL-02) move from Phase 1 to Phase 3, as its first steps.** The zone add + tasjeel NS change is only needed for the media custom domain and www. SAFE-05 (stray `ignat`/`nataly` NS) stays in Phase 1 and must close before Phase 3 starts.
3. **Phase 2 "Depends on":** change from "Phase 1" to "Phase 1.1 (landed)". Phase 2 writes no live migration. SAFE-01/02/04 must close before Phase 3's live migrations; SAFE-03 (CI) is not a Phase 2 blocker (local gate + clean-clone check per CLAUDE.md).
4. **PLAT-08 reword:** "Deploys to Cloudflare run with local wrangler from the control session after `npm run gate:local` passes and Koss says Ship; `wrangler whoami` shows the ClickitStory account first. No deploy token in GitHub." Phase 2 criterion 5 and the "[OWNER] add the GitHub Environment" item change to match.
5. **MEDIA-03 split.** The copy of every Supabase Storage object to R2 with checksums (plus optimized variants) moves to Phase 2. The DB URL rewrite with a backup table and "zero old-host URLs" stays in Phase 3 (live-DB, owner-approved). Replace "86" with "every object in the reviewed manifest" (count re-read at copy time).
6. **MEDIA-04 reword:** "Images are pre-optimized when copied or uploaded (WebP/AVIF variants plus the original) and served from R2. No paid image feature. If a variant is missing, the original shows, never a broken image."
7. **Phase 2 criterion 4 reword:** "...displays from the R2 media origin (the media Worker on workers.dev now; `media.clickitstory.ae` after Phase 3)." **MEDIA-02** stays in Phase 3.
8. **Phase 2 owner list:** drop the Queue (email queue is Phase 5) and the GitHub Environment; the media custom domain moves to Phase 3; "enable Supabase CAPTCHA" moves to the Phase 3 cutover; "Image Transformations" decision is closed by D-03 (not used).
9. **PLAT-04 note:** crons are wired in Phase 2 and switched on at the Phase 3 cutover after the Vercel crons are off.

</proposed_roadmap_changes>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/ROADMAP.md` — Phase 2 goal and criteria; Phases 3 and 8 for the cutover and cleanup
- `.planning/REQUIREMENTS.md` — PLAT-01..09, MEDIA-01, MEDIA-04..06 (plus MEDIA-03 copy part, PLAT-10 code part, if Koss signs edits 1 and 5)
- `.planning/research/STACK.md` — versions, OpenNext config, limits, wrangler shape (note: its image section is superseded by D-03)
- `.planning/research/ARCHITECTURE.md` — bindings, presign/finalize, cron pattern, cutover order
- `.planning/research/PITFALLS.md`
- `.planning/phases/01.1-admin-actions-hardening-inserted/01.1-CONTEXT.md` — SVG rejection, upload guards that Phase 2 builds on

### Code
- `next.config.ts` — CSP, images, BotID wrapper, bodySizeLimit
- `src/lib/supabase-media.ts` — media origin, cutover flag, Supabase→R2 URL mapping
- `src/lib/r2-media-core.ts` — current S3-SDK dual-write code (to be replaced)
- `scripts/migrate-supabase-media-to-r2.mjs` — manifest + verified copy (extend for variants)
- `scripts/upload-compressed-hero-videos.mjs`, `scripts/check-show-hero-video-sizes.mjs`
- `src/proxy.ts`, `src/app/api/cron/*`, `src/app/api/cdn/storage`, `vercel.json`
- PR Loomlyne/Clickit#16 diff (`next.config.ts`)

### Rules
- `CLAUDE.md` (project), `~/.claude/CLAUDE.md`, `~/.claude/rules/control-session.md`, `.hermes.md`

</canonical_refs>

<code_context>
## Existing Code Insights

(Filled from the read-only code scan; see 02-RESEARCH.md for the full inventory.)

- `getPublicMediaOrigin()` requires an https origin with path `/` and the `verified` flag; `toPublicR2MediaUrl()` maps `…/storage/v1/object/public/<bucket>/<key>` to `<origin>/<bucket>/<key>` for buckets `show-artwork`, `site-assets`, `avatars`.
- The copy script already builds a manifest (dry-run default), refuses a changed source, copies with sha256 and metadata verification, and is re-runnable. It uses `@aws-sdk/client-s3` (fine in a Node script, not in the Worker).
- `next.config.ts` wraps the config with `withBotId`, allows `*.supabase.co` in CSP, keeps `bodySizeLimit: '55mb'`, and uses Vercel's image optimizer (`formats: avif, webp`).
- `package.json`: `next ^16.2.9`, `sharp`, `botid`, `@vercel/analytics`, `@vercel/speed-insights`, `@aws-sdk/client-s3` in dependencies.

</code_context>

<specifics>
## Specific Ideas

- Koss's words for the goal: "remove deployment from Vercel, move it to Cloudflare with the images."
- Every owner step is one numbered step with the exact command, then wait. Secrets stay in his terminal.

</specifics>

<deferred>
## Deferred Ideas

- Email queue, Resend app emails, Supabase SMTP (Phase 5).
- Cloudflare Image Transformations or the `IMAGES` binding: only on a priced OK from Koss.
- Cache purge integration / `doShardedTagCache`: only at higher traffic.

</deferred>

---

*Phase: 02-worker-and-r2-media-on-workers-dev*
*Context gathered: 2026-10-19/20*
