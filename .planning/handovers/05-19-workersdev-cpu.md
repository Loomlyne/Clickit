# Hand-over 05-19: email consumer CPU on workers.dev (controller runbook)

**Owner:** the Clickit controller. Work sessions do not run this.
**Why:** the Mac harness is not Worker CPU. The real gate for the pre-rendered consumer (D-38, Workers Free 10 ms CPU per invocation) is one cold queue batch measured on Cloudflare before the Phase 3 cutover (controller decision on 05-19, 2026-10-25).
**Gate:** the first probe batch after a fresh version has `outcome` `ok`, `batchSize` 5, the probe log `sends=5`, and `cpuTime` < 10 ms. Take three cold samples (Step 6) and gate on the largest.

## Hard limits (all hold by construction)

- **No live DB write or read.** Probe messages never reach `claimOutbox` / `finishOutbox` on Supabase. `src/server/email/cpu-probe.ts` answers claim, finish and Resend with an in-process canned `fetch`, and any other URL throws. That is 0 subrequests.
- **No email to anyone.** The Resend call is answered in-process. The Worker's `RESEND_API_KEY` is not read (the probe uses fixed fake values), so the key need not exist.
- **No secret in a file.** `EMAIL_CPU_PROBE` is set with `wrangler secret put` only so that it survives deploys without editing `wrangler.jsonc`. Its value (`until:<UTC time>`) is not secret. The sender script's OAuth token is read from `wrangler auth token --json` into memory, and it is never printed or written.
- **Off by default, refuses unless set.**
  - When `EMAIL_CPU_PROBE` is unset or anything other than `until:<YYYY-MM-DDTHH:MM[:SS]Z>` in the future and at most 24 h ahead, probe messages are acked and dropped (log `[email/cpu-probe] refused n=<k>`).
  - The flag expires on its own.
  - The sender script refuses without `--confirm-workersdev-probe`, outside `HOME=/Users/koss/.clickit-cloudflare`, or with any Cloudflare token env set.
  - Unit tests: `tests/unit/email-cpu-probe.test.ts` and `tests/unit/email-cpu-probe-send.test.ts`.
- **Non-probe messages are untouched.** They go to the real consumer as before.

## What the test needs (worked out from the code)

| Need | Answer |
|---|---|
| Queues | `clickit-email` and `clickit-email-dlq` must exist (05-35 creates them). Deploying a consumer binding to a queue that does not exist fails. |
| Separate test queue? | **No.** Probe messages are tagged (`probe: "email-cpu-v1"`) and handled in-process. A second queue would need a second consumer block in `wrangler.jsonc` on both targets (the drift test), for the same Worker `clickit`. Before cutover nothing else produces to `clickit-email`. |
| Enqueue without the live outbox | wrangler 4.151.2 has no `queues send` (`wrangler queues --help`: list, create, update, delete, info, consumer, pause-delivery, resume-delivery, purge, subscription). So `scripts/email-cpu-probe-send.mjs` pushes one batch of 5 probe messages through the Queues HTTP push API (`POST /accounts/e329b099b6e4272fc0915a99832e47fe/queues/<queue_id>/messages/batch`). It uses the pinned wrangler OAuth login, whose scopes include `queues:write`. |
| Sends inert | They are answered in-process (see Hard limits). On workers.dev today `RESEND_API_KEY` is also unset, so even a real row would only reach `not_configured`. |
| CPU source | The `wrangler tail --format json` events of the queue invocation. `cpuTime` and `wallTime` are `TraceItem` fields in `@cloudflare/workers-types`, and `event.queue` / `event.batchSize` are `TraceItemQueueEventInfo`. **Not verified:** that wrangler 4.151.2's tail JSON prints `cpuTime`. Fallback: dashboard, Workers & Pages > clickit > Observability > Invocations, the queue invocation at the logged time, CPU time column. |
| Queue ops (Free) | 1 bulk push of 5, plus delivery and ack: about 15 operations per sample. |

## Exact commit

The deploy needs a commit that contains `d0209476` (probe in `queue()`) and `2cf2e6a7` (sender). On branch `claude/phase-05-accounts-and-email-61ece8`, that is **`122c141e`** or any later commit, including `main` after the Phase 5 PR lands. The commit must be on GitHub first, because the deploy clone reads GitHub.

Note: deploying the branch puts all of the Phase 5 app code on workers.dev (auth wall, MFA) against the live project, without the Phase 5 migrations live there. Pages that need them will error on workers.dev until the migrations are applied. If that matters, wait for main after the Phase 5 PR lands. The probe itself needs no migration.

## Runbook (controller, one step at a time; each line is run from a terminal)

0. **Pre-checks (read-only).**
   ```
   HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 whoami        # ClickitStory account e329b099…
   HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 queues list   # clickit-email and clickit-email-dlq listed
   ```
   If either queue is missing, stop: 05-35 comes first.

1. **Deploy the commit to workers.dev with the guarded path.** In `/Users/koss/.clickit-checks/deploy-workersdev.sh`, change both `787ca3a` lines to `122c141e` (or the main sha). Then run it detached as usual:
   ```
   caffeinate -i -s -m perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' zsh /Users/koss/.clickit-checks/deploy-workersdev.sh &
   ```
   The log `/Users/koss/.clickit-checks/deploy-workersdev.log` must end `exit=0`. Its binding list must show `env.EMAIL_QUEUE (clickit-email) Queue`. (The script runs `npm run cf:deploy:workersdev -- --media-flag off`: the deploy guard, then `opennextjs-cloudflare deploy`.)

2. **Start the tail** in its own terminal and leave it running. Only the controller's own process writes this file:
   ```
   HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 tail clickit --format json > /Users/koss/.clickit-checks/p5-probe-tail.jsonl
   ```

3. **Turn the probe on for 2 hours.** Setting the secret creates a new version, so the next queue invocation is cold:
   ```
   printf 'until:%s' "$(date -u -v+2H +%Y-%m-%dT%H:%M:%SZ)" | HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 secret put EMAIL_CPU_PROBE --name clickit
   ```

4. **Send one probe batch** from a checkout of the deployed commit (the repo, at that sha):
   ```
   HOME=/Users/koss/.clickit-cloudflare node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/email-cpu-probe-send.mjs --confirm-workersdev-probe --run cold-1
   ```
   Expected output: `sent probe batch queue=clickit-email run=cold-1 n=5 at=<time>`.

5. **Read the result** within about 30 s (batch timeout 5 s):
   ```
   jq -c 'select(.event.queue == "clickit-email") | {at: (.eventTimestamp/1000 | todate), outcome, cpuTime, wallTime, batchSize: .event.batchSize, logs: [.logs[]?.message[]?]}' /Users/koss/.clickit-checks/p5-probe-tail.jsonl
   ```
   Expected: `"outcome":"ok"`, `"batchSize":5`, and a log `[email/cpu-probe] run=cold-1 n=5 bad=0 sends=5`. Record `cpuTime` (ms) and `wallTime`.
   - If `batchSize` is below 5 (the delivery was split), the sample does not count; repeat Steps 3 and 4.
   - If `cpuTime` is missing from the JSON, read the CPU time in the dashboard (see the table above).

6. **Two more cold samples.** Repeat Step 3 (new window value, which means a new version and fresh isolates), then Step 4 with `--run cold-2`, then Step 5. Do the same with `--run cold-3`. Optional warm sample: Step 4 again with `--run warm-1` within a minute of a cold one, without Step 3.

7. **Turn the probe off and clean up.**
   ```
   HOME=/Users/koss/.clickit-cloudflare npx wrangler@4 secret delete EMAIL_CPU_PROBE --name clickit
   ```
   Stop the tail (Ctrl-C in its terminal). Keep `/Users/koss/.clickit-checks/p5-probe-tail.jsonl` as the evidence. `wrangler secret list --name clickit` must no longer show `EMAIL_CPU_PROBE`. The flag would expire by itself 2 h after Step 3 anyway.

8. **Record** in `05-19-SUMMARY.md` (section "Workers.dev CPU gate") these lines:
   ```
   workersdev_commit: <sha>
   workersdev_cold_cpu_ms: <cold-1>, <cold-2>, <cold-3>
   workersdev_cold_cpu_ms_max: <max>
   workersdev_warm_cpu_ms: <warm-1 or n/a>
   workersdev_gate: <PASS if max < 10 else FAIL>
   ```
   If FAIL, stop the cutover. Options: lower `max_batch_size` (2 or 1), profile the fill, or Workers Paid ($5/mo, Koss's pricing call).

## If something goes wrong

- **The sender fails `http 403 codes=...`:** the OAuth login lacks `queues:write`. Do not create an API token in a file. Re-run `wrangler login` under the pinned HOME (it is Koss's step, in his terminal), or send the 5 messages from the dashboard (Queues > clickit-email > Messages > Send). Use these bodies, with the five fixtures 0 to 4 and fresh UUIDs: `{"probe":"email-cpu-v1","run":"cold-1","fixture":0,"outboxId":"<uuid>"}`. The dashboard sends them one at a time. Send all five within 5 s (`max_batch_timeout`) so they arrive as one batch, and check that `batchSize` is 5.
- **The tail shows `outcome: exception`:** read `.exceptions`. Probe messages are acked even when the flag is off, so nothing reaches the DLQ unless a probe batch threw.
- **Messages land in `clickit-email-dlq`:** `wrangler queues purge clickit-email-dlq` (they are probe messages only, with no DB rows).
