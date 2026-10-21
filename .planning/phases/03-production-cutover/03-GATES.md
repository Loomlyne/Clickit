# Phase 3 gate file: Branch B wording, inventories, ceilings, deviations

Written by plan 03-06 on 2026-10-21, next to `03-RUNBOOK.md`. The controller and Koss read it at the runbook steps that name it. Nothing here has been applied to ROADMAP.md or REQUIREMENTS.md: 03-13 does that, and only what is signed.

## (1) Signed decisions

- D-01..D-19 SIGNED by Koss: Q1-Q18 = A, 2026-10-20 ~17:55 CET (relayed by the controller), recorded in `03-CONTEXT.md`. D-07, D-11 and D-18 are derived from the signed answers.
- Plan gate G1-G7 signed 2026-10-20 ~18:15 CET; G8 (three crons), G9 (code plans start, P3-pre-cpu stays a hard gate), G10 (sweep reports first, deletes after the rewrite on "sweep deletes on") signed 2026-10-21 15:03 CET; G11 (Phase 2 UAT and media verify move to runbook Step 0c) signed 2026-10-21 ~15:10 CET. All in `03-PLAN-GATE.md`.
- Amendments A-1..A-6 (`03-CONTEXT.md`): P3-pre-cpu = Step 0a, P3-pre-migration = Step 0b, three crons at Step 26, P3-8b = Steps 36a and 52a, Step 0c.

## (2) Branch B wording (D-01 fallback)

Signed with Q1 A as the fallback until Vercel access returns. Applied by 03-13 only if branch B is taken (no sign-in to the Vercel owner account `clickitstory@gmail.com` at Step 27 or Step 55).

- **Branch B, ROADMAP Phase 3 criterion 2** ->
  "The Worker cron publishes from the flip; Vercel's crons cannot reach live data after the proof window closes because the legacy keys are deactivated; the service key in use is the new secret key."
- **Branch B, PLAT-11** ->
  "The Vercel project can no longer serve clickitstory.ae (no record points at it) or reach any data (legacy keys off); deletion follows when the owner account signs in."

Proof that backs the wording: Step 42 (`keys-check legacy-off: PASS`), Step 54 (`dns-check final: ALL PASS`, no vercel target in the zone), Step 26 (three Worker crons), Step 35 (publish-scheduled status 200 on the Worker). Until the owner signs in, the frozen Vercel crons may still fire; from Step 41 they fail against Supabase.

## (3) Legacy-key consumer inventory (D-02, research Pattern 4)

Supabase has no usage indicator for the legacy keys, so this list is the manual check confirmed at Step 40, before Step 41 switches the legacy `anon` and `service_role` keys off together. Source: `grep -rln "SUPABASE_SERVICE_ROLE_KEY\|SUPABASE_ANON_KEY" scripts .github` on the phase branch, 2026-10-21, plus the runtime places.

| Consumer | Key it reads | Who runs it | What to set before Step 41 |
|---|---|---|---|
| `scripts/backfill-translations.mjs` | `SUPABASE_SERVICE_ROLE_KEY` (env) | Koss / an operator, by hand | the `sb_secret_…` value (`clickit-worker` or a second secret key per tool), typed with `read -rs` |
| `scripts/fix-archived-show-duplicates.mjs` | `SUPABASE_SERVICE_ROLE_KEY` | operator, by hand | same |
| `scripts/migrate-supabase-media-to-r2.mjs` (`npm run r2:media`) | `SUPABASE_SERVICE_ROLE_KEY` | Koss (Steps 13-15, Step 38) | same; Steps 13-15 run before Step 41, so they may still use the legacy key; Step 38 after Step 41 needs the new one |
| `scripts/check-show-hero-video-sizes.mjs` | `SUPABASE_SERVICE_ROLE_KEY` | operator, by hand | same |
| `scripts/rewrite-slugs.mjs` | `SUPABASE_SERVICE_ROLE_KEY` | operator, by hand | same |
| `scripts/upload-compressed-hero-videos.mjs` | `SUPABASE_SERVICE_ROLE_KEY` | operator, by hand | same |
| `scripts/cf/check-revalidate.mjs` | `SUPABASE_SERVICE_ROLE_KEY` (local stack key) | work sessions, local only | nothing (local stack keys are not the live legacy keys) |
| `scripts/cf/build-target.mjs` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the target env file | controller (builds) | production: already the publishable key (Step 21, refused otherwise). workers.dev: `/Users/koss/.clickit-cloudflare/clickit.workersdev.env` must get the publishable key before the next workers.dev build after Phase 3 closes (D-18 refuses that build until then) |
| `.github/workflows/pr-gate.yml` | `NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key` | CI | nothing (placeholder only) |
| Worker `clickit` secret `SUPABASE_SERVICE_ROLE_KEY` | live service key | the app | already the `sb_secret_…` value from Step 19 |
| Worker build (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) | public key in the bundle | the app | already the publishable key (Steps 21, 25) |
| Frozen Vercel deployment | legacy anon + service_role (its own env) | Vercel (frozen) | nothing: losing the database at Step 41 is the intended effect |
| Koss's `/Users/koss/Developer/Clickit/.env.local` and any operator shell profile | whatever live keys they hold | Koss | the publishable and `sb_secret_…` values (or remove live keys from them) |

Not affected: `apply-live-migrations.yml` (uses `SUPABASE_DB_URL`, the database password, not an API key); `keys-check.mjs`, `proof-check.mjs`, `media-health.mjs`, `verify-media-host.mjs` (public GETs; keys-check finds keys in the public bundles at run time and never stores them).

## (4) Rollback ceiling (D-03, research Pattern 10, Pitfall 5)

- The proof window closes by **min(2026-12-15, Vercel certificate notAfter minus 14 days)**.
- Vercel's www certificate read 2026-10-20: notAfter **2026-12-29 02:45 UTC** (re-read 2026-10-21 by the 03-04 smoke: Dec 29 02:45:11 2026 GMT, ceiling 2026-12-15). Vercel renews only while the domain resolves to Vercel, so after the flip the date is fixed. The certificate is re-read at Step 1 and Step 31; Step 31 writes the `close-by` date.
- Second ceiling: Supabase deprecates the legacy keys by the end of 2026 ("late 2026: legacy keys deleted", TBC). A Vercel rollback needs them.
- www served HSTS (`includeSubDomains; preload`) from Vercel, so a rollback after the certificate expires is a hard outage for returning visitors: never roll back to Vercel after the close-by date.
- From Step 41 a rollback to Vercel serves no data; from Step 53 `rollback.mjs` refuses (the record no longer points at Vercel).

## (5) Proof-window risk list

1. **Auth forms without CAPTCHA until Step 44 (Pitfall 6).** Sign-in, sign-up and reset on www have no bot protection beyond the Turnstile widget token that Supabase does not check yet; contact and newsletter are verified server-side.
2. **Monday 04:00 UTC Vercel cleanup run (Pitfall 4).** With no Vercel access (branch B) the frozen Vercel cleanup cron may run inside the window and delete Supabase originals that no row references by a Supabase URL. Admin replacements made on the Worker write R2 URLs, so replaced Supabase originals look orphaned. R2 holds the copies (no data lost), but the deletion comes before MEDIA-07's approval. Hence the media freeze (Step 13) until that Monday has passed.
3. **Fixed-key overwrites on rollback (Pitfall 3).** After a rollback, an admin upload on Vercel writes Supabase only; fixed keys (favicon, OG image, avatars, hero video) go stale in R2. Step 38 re-syncs before any re-flip.
4. **100,000 requests/day shared limit (D-17).** Workers Free counts every Worker request; on overflow the route fails open to the Vercel target during the window (Step 30), back to fail closed at Step 46. The daily check (Step 36) records the count.
5. **workers.dev redeploy (D-18, Pitfall 7).** A workers.dev deploy of `clickit` would drop the www route, the production build and the crons. The guard refuses it after Step 26 unless `--override-production-reason` names a reason Koss gave.
6. **Cron CPU on Workers Free.** Cron invocations also have 10 ms CPU; Step 0a measures page requests only. Steps 35, 36 and 36a read `exceededCpu` on the cron runs; a hit goes to Koss as the Workers Paid price question.
7. **YouTube key missing.** If Step 0b reads `has_key` false, youtube-recheck answers 503 `key_missing` every night until Koss saves the key; not a rollback trigger.

## (6) Deviations from decision wording (each with the reason)

- **D-08 "verify, then deploy"** -> the runbook verifies right after the R2-first deploy (Step 17 after Step 16): only an R2-serving Worker can serve the variants and remuxed videos the verify checks; the Supabase fallback covers the gap; rollback is one deploy (`npm run cf:deploy:media -- --env supabase-only`).
- **DNS-03 "service-role key rotated"** -> a new `sb_secret_…` key on the Worker (Step 19) plus the legacy keys deactivated (Step 41). Rotating the legacy keys is no longer possible (research Pattern 4); signed as G4.
- **D-12 one 00:55 cron** -> amended by G8 / A-3: the three Phase 2 crons `0 1 * * *`, `30 1 * * *`, `0 4 * * 1` from Step 26; publish refreshes on every run (03-01).
- **D-14 "the controller digs both Cloudflare NS"** -> `dns-check.mjs` also asks every `.ae` registry server and checks the jen/brett SOA serials in every phase (stricter).
- **G-DNS "every dns-check passes the Resend flags"** -> every call from Step 6 on, except the `--phase ns` reads (Steps 1, 2, 56), which check only the registry and take no Resend flags.
- **Phase 2 runbook Part B mapped:**
  - P3-pre-cpu -> Step 0a; P3-pre-migration -> Step 0b (versions re-read at Step 25); P3-pre-max-rows done by Koss 2026-10-21 (1000).
  - P3-1..P3-5 done in Phases 1-2, re-proven at Steps 1-2.
  - P3-6 Vercel crons off -> Step 27 (after the Worker cron is live at Step 26, before the flip at Step 32).
  - P3-7 CAPTCHA -> Step 44.
  - P3-8 three crons -> Step 26 (D-12 amended by G8). Phase 2's "only after P3-6" is replaced by D-01/D-12: the overlap with a frozen Vercel cron is accepted because publish is idempotent and refreshes on every run.
  - P3-8b -> Steps 36a and 52a. Step 52a deploys through the production target (`cf:deploy:production -- --allow-upload-sweep-delete`), not `cf:deploy:workersdev` as 02-RUNBOOK P3-8b item 2 says, because a workers.dev deploy after the flip drops the www route and the crons (D-18).
  - P3-9 custom domains -> the D-07 route `www.clickitstory.ae/*` plus the proxied flip (G5); the apex keeps its redirect rule (D-05).
  - P3-10 -> Steps 47-52. P3-11 -> G4 (Steps 19, 41, 42). P3-12 -> Part G. P3-13 -> Step 55.
- **Probe path.** The plan wrote `proof-check` without a path; the locale root `/en` answers 308 to `/en/portfolio` on the frozen site and on the Worker (`src/server/locale-root.ts`), so every runbook call passes `--site-path /en/portfolio` (03-04 added the flag).
- **Step 28 extra proof.** Added `proof-check --expect worker --site https://clickit.clickitstory.workers.dev`: the production build answers on workers.dev with the marker header, which proves the build before the flip even if the grey-record pinned probe (research A1) still shows Vercel.
- **Step 40 extra baseline.** Added `keys-check --captcha-probe off` before CAPTCHA goes on, so Step 45's `on` result is compared with a recorded `off`.

## (7) Rewording for Koss's signature

G2, G3 and G5 were signed as meanings at the plan gate (2026-10-20 ~18:15 CET). The exact lines 03-13 Task 2 writes into ROADMAP.md and REQUIREMENTS.md are below; Koss signs each line (or says "as signed at G2/G3/G5"). An unsigned line is not applied; 03-13 then records it (e.g. "D-05 rewording: not signed").

- **D-05 (G2) -> ROADMAP Phase 3 criterion 1 and DNS-02:**
  "www.clickitstory.ae is served by the Worker (server: cloudflare, real HTML, working sign-in); the apex redirects 301 to www, which serves real HTML from the Worker"
  (G2's signed text for criterion 1: "Opening https://www.clickitstory.ae returns `server: cloudflare` with real HTML from the Worker; https://clickitstory.ae redirects (301) to www. A real account can sign in and play an episode on www." Same meaning; 03-13's check looks for "apex redirects 301 to www" in REQUIREMENTS.md.)
  Signature: ____________ Date: ____________
- **D-10 (G3) -> MEDIA-02:**
  "Every stored photo and video is served from media.clickitstory.ae; the database holds only R2 URLs for stored media; external placeholder images (picsum.photos) are excluded and listed"
  (G3's signed text ends "(external placeholder images are not stored media)"; this line adds that they are listed in the rewrite report, Step 51.)
  Signature: ____________ Date: ____________
- **D-07 (G5) -> the Phase 3 owner-gated item "[OWNER] attach the Worker custom domain to www and the apex":**
  "[OWNER] switch the www record to proxied (Worker route www.clickitstory.ae/*); the apex keeps its redirect rule"
  (G5's signed text: "deploy the Worker with the `www.clickitstory.ae/*` route, then switch the `www` record to proxied (the flip); rollback = switch it back to DNS only".)
  Signature: ____________ Date: ____________

## (8) Controller follow-ups (the work session edits neither file)

- /Users/koss/Developer/Clickit/CLAUDE.local.md line 32 ("re-sync with npm run r2:copy per .planning/handovers/r2-media-copy.md") -> replace with "re-sync with npm run r2:media (--refresh, review, --execute) per 03-RUNBOOK.md Steps 13-15; never r2:copy --update-changed". Read 2026-10-21: already applied as G7 (the rule now sits in the Gate facts line about #24: re-sync media only with `npm run r2:media -- --refresh` then `--execute`; r2:copy would overwrite the fast-start videos). Nothing left in that file.
- `.planning/handovers/r2-media-copy.md`: still has no "superseded" header on main or on this branch. The controller adds one header line: "Superseded for re-sync by `npm run r2:media` (03-RUNBOOK.md Steps 13-15); never `r2:copy --update-changed` after r2:media ran (it overwrites the remuxed videos)."

## (9) Findings from writing the runbook against the code (03-06, 2026-10-21)

1. **check-gates expects `/en` and `/ar` to answer 200, but both answer 308 to `/<locale>/portfolio`** since the 02-21 CPU work (`src/server/locale-root.ts`, `src/proxy.ts`). `node scripts/cf/check-gates.mjs --base <Worker>` will therefore print `FAIL GET /en answers 200 (status 308)` and the same for `/ar`, and never `ALL PASS`, at Steps 28, 33, 36, 42, 54 and 56. `scripts/cf/check-gates.mjs` is a Phase 2 file outside this plan; the fix is one small reviewed change (accept a 308 to `/<locale>/portfolio`, or probe `/<locale>/portfolio` for 200) on its own branch, landed before Step 28. Until then the runbook's `ALL PASS` cannot be met; do not wave the two lines through by hand.
2. **keys-check legacy-off requires exactly 401.** If Supabase answers a deactivated legacy key with 403 (or anything else), Step 42 FAILs with that status and body. That is a finding for Koss; the judge then needs a one-line reviewed change. Never record a manual pass.
3. **`rollback.mjs --verify-token` calls `/user/tokens/verify`,** which accepts user tokens only. Step 23 tells Koss to create the token under My Profile, API Tokens; an account-owned token would fail the check even if it could edit DNS. Neither has been tried against the live API yet; Step 23 is the first real check.
4. **dns-check refuses `--resend-mx`/`--dkim-file` without `--phase resend` or `--with-resend`** (no hidden state). Every runbook call is written with all three flags from Step 6 on.
5. **Notices through the Management API.** `supabase db query --linked` may not print `raise notice` lines; Step 50 reads the run id from the backup table if they are missing.
6. **Local test logs vs ops logs.** The 03-05 SQL proof logs sit under `/Users/koss/.clickit-checks/p3-exec/` (`p3-sql-test.log`, `p3-sql-test-r2.log`); ops logs live under `/Users/koss/.clickit-checks/p3-ops/` (runbook rule 8).
7. **The rewrite, scan and preflight also cover the Phase 2 option A test host** `clickit-media-r2.clickitstory.workers.dev` (03-05 follow-up fix); other subdomains of either media Worker name count as not rewritable (Step 47 stops).
