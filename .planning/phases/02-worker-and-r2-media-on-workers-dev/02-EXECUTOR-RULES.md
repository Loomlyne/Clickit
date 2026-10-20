# Phase 2 executor rules (job C, work session)

Every gsd-executor for a Phase 2 plan reads this first. These come from the Clickit common rules (`/Users/koss/Developer/Clickit/.planning/prompts/00-common-rules.md`) and from what earlier plans in this phase found.

## Where and how
- Working dir `/Users/koss/Developer/Clickit/.claude/worktrees/phase-02-execute-19d86a`, branch `claude/phase-02-execute-19d86a`. SEQUENTIAL executor on this tree: normal commits with hooks, never `--no-verify`. Never commit or push `main`. Do not push (the session that started you pushes).
- Commit each task atomically: `feat(02-NN)`, `fix(02-NN)`, `test(02-NN)`, `docs(02-NN)`, ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- REQUIRED ORDER at the end: write `02-NN-SUMMARY.md` → commit → update STATE.md/ROADMAP.md progress → commit → only then narrate.

## Hard stops (record as an owner/controller item, skip the step, keep going with the rest)
- No deploy, no remote wrangler command (whoami/types/dry-run with `--outdir` are local and OK), no Cloudflare resource creation, no secrets, no Turnstile keys, no DNS, no live Supabase (`lajguozmtissnnfccmej`) read or write, no emails to real people.
- Cloudflare: ONLY `HOME=/Users/koss/.clickit-cloudflare` (project wrangler or `npx wrangler@4`) after `npm run cf:guard:local`. Never the default wrangler login, never the Cloudflare MCP connector, never `CLOUDFLARE_API_TOKEN`.
- No Vercel anything (removal of Vercel code is plan 02-14).
- If a decision needs Koss (UI not signed, paid feature, pricing, legal copy), stop that part and report it.

## Machine rules
- Heavy steps (`npm run build`, `npm run cf:build`, `npm run cf:preview`, `npm run gate:local`, Playwright) take the shared lock, one at a time across ALL Clickit sessions:
  `until mkdir /Users/koss/.clickit-heavy.lock 2>/dev/null; do sleep 20; done; echo $$ > /Users/koss/.clickit-heavy.lock/pid; <command>; rm -rf /Users/koss/.clickit-heavy.lock`
  Long ones run detached (`perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' caffeinate -i -s -m bash -c '...'`; macOS has no `setsid`) with a log in `$HOME/clickit-phase02-logs/` ending in `exit=<code>`, lock released inside the script even on failure. Poll the log.
- `npm run lint`, `npm run test:unit`, `node --test`, `tsc --noEmit` need no lock.
- Builds in this worktree without `.env.local` need `NEXT_PUBLIC_SUPABASE_URL=https://lajguozmtissnnfccmej.supabase.co` and a dummy `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the env (job D note); otherwise `/[locale]/legal/[slug]` fails with "supabaseUrl is required". These are public values; never put the service key anywhere.
- Local Supabase: one stack on the Mac at a time. Check `docker ps` first. If another Clickit stack is already running you may read it; do not start a second one. Stop only a stack you started.
- Kill only processes you started, by recorded PID. Never `pkill`/`killall`/pattern kill. Port 8787 may belong to another session; use another port if busy.

## Known state (from earlier Phase 2 plans)
- `gsd-sdk query state.advance-plan` / `state.record-session` / `requirements.mark-complete` have repeatedly marked phases complete, changed status to "verifying"/"Phase complete", changed counts, or ticked requirements the plan only starts. After every state command, diff STATE.md/REQUIREMENTS.md and revert any field that claims Phase 01.1 or Phase 2 complete, and untick requirements this plan does not fully deliver. The controller owns Phase 01.1 status.
- Lint must stay at 0 errors (`react-hooks/set-state-in-effect` is a warning on purpose, see `deferred-items.md`).
- The media Worker is job D's `workers/media/` (name `clickit-media`), extended by 02-03. Its R2 binding is `MEDIA_BUCKET` (not `MEDIA`), it keeps a Supabase-original fallback and a `supabase-only` env. The Next app Worker (root `wrangler.jsonc`, name `clickit`) has its own `MEDIA` binding; do not confuse them. Variant keys: `_v/<w>/<avif|webp>/<bucket>/<key>`; widths 640, 1280, 1920.
- `src/server/` helpers from 02-04: `cronAuthOk` is async; `decideRateLimit` takes `windowMs` in ms; the `rate_limits` table only has a `key` column, so fold the IP into the key.
- Unknown route `/en/auth/sign-in` returns 500 (not 404) on next start and preview; open item in `deferred-items.md`. Do not assert 404 for unknown paths until fixed.
- Bundle: 15.1 MiB raw / 3.08 MiB gzip; Cloudflare limit is 64 MiB uncompressed, no compressed limit (checked 2026-10-20).
- Other sessions (design pass B1-B4) work on UI in their own branches; keep UI edits to exactly what the plan says.

## Report back
Commits, test totals, lint result, deviations, owner/controller items, whether the heavy lock is free.
