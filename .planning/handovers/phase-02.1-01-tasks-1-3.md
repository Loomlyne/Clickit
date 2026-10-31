# Plan 02.1-01, Tasks 1-3: hand-over to the controller

Tools built and the local write-free proof done. All six request kinds are write-free on 787ca3a's code. Nothing remote was called on purpose: no workers.dev, no tail, no deploy, no live Supabase. One wrangler note is under "Tell Koss or decide". PLAT-09 stays pending.

Proof: `/Users/koss/clickit-phase021-logs/stop-line/local-proof.json` (outside the repo). Earlier runs, the smoke run and the runner script: `local-evidence/` beside it.

## Proof summary

| Kind | Verdict | Tries | Writes | Log check per try |
|---|---|---|---|---|
| admin-page | write-free | 6 (all rotation pages, RSC included) | 0 | - |
| admin-save | write-free | 5 | 0 | - |
| signin-link | write-free | 5 | 0 | flow-state 5 of 5 |
| contact | write-free | 5 | 0 | missing-token 5 of 5 |
| signin-action | write-free | 5 | 0 | Invalid login credentials 5 of 5 |
| signup-validation | write-free | 5 | 0 | - |

- Positive control: a real save moved `app_config` updates by 1 and `admin_audit_log` inserts by 1, so the detector works.
- Idle control: 0 tables moved with nothing sent.
- `signinLinkForm`, a string on local: `exchangeCodeForSession failed","AuthApiError: invalid flow state, no valid flow state found"]`.

## Measured writes, for the Task 4 consent text

Quote these from `local-proof.json`.

| Step | Table: inserts, updates, deletes |
|---|---|
| `signInWrites` | `auth.audit_log_entries` 1,0,0; `auth.mfa_amr_claims` 1,0,0; `auth.refresh_tokens` 1,0,0; `auth.sessions` 1,0,0; `auth.users` 0,1,0 |
| `signOutWrites` | `auth.audit_log_entries` 1,0,0; `auth.mfa_amr_claims` 0,0,1; `auth.refresh_tokens` 0,0,1; `auth.sessions` 0,0,1 |
| `signOutExpiredWrites` | `auth.audit_log_entries` 3,0,0; `auth.mfa_amr_claims` 0,0,1; `auth.refresh_tokens` 1,1,2; `auth.sessions` 0,1,1; `auth.users` 0,1,0 |

The local JWT lasted 1 hour. Local session rows after both sign-outs: 0.

## Where this differs from the plan

1. Worktree: the app made `.claude/worktrees/happy-kare-c00282`. The branch is the plan's `phase-02.1-test-first`, so the plan's verify paths need this folder or the clean clone.
2. Stack: the plan says no start. The controller's go allowed one plain start, done at 15:13Z with Homebrew CLI 2.121.0 from this branch's config. It is still running. No reset, no stop, no migration applied.
3. Local base is `http://localhost:8796`, not `127.0.0.1`: the preview builds its redirects from that host. Replies are still exact, and a redirect to another host still fails.
4. Log evidence comes from the preview's local log store (`/cdn-cgi/local/explorer/api/local/observability/query`), per try by `sl` tag. wrangler keeps worker console lines there and does not print them to the preview log the plan named.
5. Additions, each stricter or needed: an idle control before any measurement; a per-try log check for signin-action; action-ids exit 8 when one name is bound to two ids; `run --kinds` to leave out a dropped kind.
6. Earlier runs: run 1 stopped at its own idle check, because setup writes landed in the window (a settle now comes first). Run 2 dropped signin-link and contact for reasons 3 and 4. No check was loosened. Both are kept in `local-evidence/`.

## Verified

- 141 unit tests across the four files pass, eslint is clean on the five scripts, `npm run typecheck` passes.
- Task 1-2 acceptance: 0o600 present, `--help` exits 0, `src/app` untouched, no token shape in `scripts/cf`, required sentences present, no `contactMode` or `junk`, `www` and no-`--proof` runs exit 2 and send nothing.
- `check-proof` exits 0, `scan-logs` on the log folder exits 0.
- Chunk ids match the same build's manifest for all four names. Action pages come from the manifest's `workers`.
- `make-session-cookie` signed in, checked and signed out on the local stack, through both sign-out paths. `/en/admin` answered 200 with the cookie and 307 without.
- `run --pass canary` ran end to end on loopback for signup-validation, signin-link, contact and signin-action: exit 0, signup proof yes. `report` rendered from it.
- Cleanup: throwaway user gone, `admin_user_id` restored, no `local-admin-*.cookie`, 787ca3a worktree removed, port 8796 closed, lock released.

## Not verified

- Anything on real tail output: the `sl=` join, the tail allowlist and the live sign-in link log form. Your canary step proves these first.
- `run` sending admin kinds through its paced loop against a server. The proof sent the same requests through the same builders; the loop itself is covered by fake-clock tests only.
- The `slow` and `fast` passes on a real server (fake clock only).
- The deployed chunk format and the `_rsc` value on workers.dev.
- Live schema, GoTrue version and limits. `--env-file clickit.workersdev.env` was not read here: if its URL is not exactly `https://lajguozmtissnnfccmej.supabase.co`, the script refuses.

## Local stack changes that remain

The positive control's real save left a newer `app_config.updated_at`, one `admin_audit_log` row, and `feature_flags` holding the four booleans. Local only.

## Tell Koss or decide

- wrangler printed `Establishing remote connection` on each preview start, because `wrangler.jsonc` at 787ca3a has `"ai": { "binding": "AI" }`, shown as a remote binding. `src` at 787ca3a does not use `env.AI`, and this is the plan's own preview command, under `HOME=/Users/koss/.clickit-cloudflare`. What that connection sent was not inspected.

## Running it

Canary, after `action-ids.mjs` (the plan's Task 5 flags):

```bash
node scripts/cf/stop-line.mjs run --base https://clickit.clickitstory.workers.dev --pass canary --run r1 --proof <local-proof.json> --ids <ids.json> --flags-file <flags.json> --show-id <id> --admin-cookie-file <cookie> --tail-file <tail-1.jsonl>
```

Exit 3 is a stop rule, exit 4 is need-cookie (add `--resume` and the new cookie file), exit 2 is refused with nothing sent. Client logs default to `stop-line/run-<run>.jsonl`.

## Per-step lines (standing rules)

- GSD skill: `gsd-execute-phase`, because this was planned phase work; Tasks 1-3 only, so no SUMMARY, STATE or ROADMAP change.
- Jev: none here. The stop rules must be exact matches, and a probability must not decide what reaches live.
- Automation, proposal only: a Worker cron that reruns the canary kinds on the final build and alerts on any non-ok tail outcome before gate 0a.
