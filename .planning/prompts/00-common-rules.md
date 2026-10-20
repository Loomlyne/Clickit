# Clickit work sessions: common rules (read first)

Controller: the session titled "Clickit controller", main checkout `/Users/koss/Developer/Clickit` on `main`.
Its local facts: `/Users/koss/Developer/Clickit/CLAUDE.local.md` (gitignored, read it by absolute path).
You are a **work session**. Koss talks only to the controller.

## Hard rules
- Own worktree, own branch. Never commit/push `main`, never deploy, never write to the live Supabase DB, never touch DNS, Vercel or secrets. Read-only selects on live only when your prompt allows it.
- Never ask Koss directly (no question form). When you need a decision, a signature or an owner step: stop, end your turn with a short report that starts with `NEEDS KOSS:` and gives the exact question, recommended option first, and the file path of any picture. The controller relays it.
- Cloudflare: only `HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 …` (ClickitStory account `e329b099…`). Never the default wrangler login, never the Cloudflare MCP connector (it is the Vamos account).
- No Vercel anything. Do not wait on Codex/CodeRabbit/Vercel checks.
- Machine: heavy steps (`npm run build`, `npm run gate:local`, Playwright) run one at a time across ALL Clickit sessions. Take the lock first:
  `until mkdir /Users/koss/.clickit-heavy.lock 2>/dev/null; do sleep 20; done; echo $$ > /Users/koss/.clickit-heavy.lock/pid; <command>; rm -rf /Users/koss/.clickit-heavy.lock`
  Playwright `--workers=2` max. Only one local Supabase stack on the Mac (C/1.1 only). Long runs detached (`perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' …`) with an `exit=` line in a log outside /tmp.
- Design before code: anything a viewer or admin sees gets a picture first (real tokens from `src/styles/globals.css` / `ui.config.json`, UI System = github.com/Loomlyne/ui-system; DESIGN.md rules: 44px targets, nothing under 11px, 4.5:1 contrast, radius roles). Code only after the controller relays Koss's signature.
- Password fields have a right-side show/hide eye. No fake toggles, no placeholders.
- Commits: conventional, end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (or your model). Merge your base branch in before hand-over; base wins conflicts.
- Before a PR: `npm run gate:local` green (under the lock). Open the PR yourself (`gh pr create`), body ends with the Claude Code line. CI runs once on PR open; no pushes to retrigger unless fixing.
- Hand-over file on your branch: `.planning/handovers/<job>.md` — final commit, gates with results, what was NOT verified, numbered UAT (type/click → expected), PR link.
- Report at the end of each turn in three lists: verified, not verified, failed.
