---
phase: 03-production-cutover
plan: 04
subsystem: infra
tags: [proof, worker-header, supabase-keys, captcha-probe, mail-auth, node-test]
requires:
  - phase: 03-production-cutover
    provides: "03-01 ENTRY: PASS gate; 03-03 dns-check and rollback (03-02 is an ordering dependency only and has not run)"
provides:
  - "src/server/runtime-header.ts: RUNTIME_HEADER, withRuntimeHeader; custom-worker.ts wraps handler.fetch with it"
  - "scripts/cutover/http-pin.mjs: pinnedRequest (curl --resolve equivalent, certificate read, no redirects followed)"
  - "scripts/cutover/proof-check.mjs: judgeSite, judgeApex, judgeCert, judgeHttpRedirect, judgeMedia, parseArgs, run"
  - "scripts/cutover/keys-check.mjs: findLegacyAnonKey, findPublishableKey, judgeKeys, judgeCaptchaProbe, redact, run"
  - "scripts/media-health.mjs: sourceVerdict and --expect-source r2|supabase"
  - "scripts/cutover/parse-auth-results.mjs: parseAuthResults (MAIL-02 judge)"
affects: [03-05, 03-06 runbook proof steps, 03-07 to 03-13 ops plans, proof window]
tech-stack:
  added: []
  patterns:
    - "Pure judge functions plus a runner with injected request/fetch/out, so tests need no network"
    - "Keys found in public bundles at run time, held in locals, printed only through redact()"
key-files:
  created:
    - src/server/runtime-header.ts
    - scripts/cutover/http-pin.mjs
    - scripts/cutover/proof-check.mjs
    - scripts/cutover/keys-check.mjs
    - scripts/cutover/parse-auth-results.mjs
    - tests/unit/runtime-header.test.ts
    - tests/unit/proof-check.test.ts
    - tests/unit/keys-check.test.ts
    - tests/unit/media-health-source.test.ts
    - tests/unit/parse-auth-results.test.ts
  modified:
    - custom-worker.ts
    - scripts/media-health.mjs
key-decisions:
  - "proof-check gets --site-path (default /en): the frozen site answers /en with 308 to /en/portfolio, so a 200 probe needs another path; the judge still requires 200"
  - "http-pin uses a fresh https.Agent with maxCachedSessions 0: on a resumed TLS session getPeerCertificate() is empty, which silently broke the second pinned certificate read"
  - "keys-check follows same-origin redirects when fetching the page (the old host redirects /en); a cross-origin redirect is an error"
  - "keys-check legacy-off requires exactly 401 (plan wording); a 403 would FAIL, which is the safe direction"
  - "keys-check --extract-only added: public GETs only, nothing sent to the API, to smoke the key finder without touching Supabase"
  - "parse-auth-results dkim alignment is an exact match on header.d (else the domain of header.i); a subdomain signature does not pass"
requirements-completed: []
duration: 15min
completed: 2026-10-21
---

# Phase 3 Plan 04: Runtime marker, proof-check, keys-check, media source, MAIL-02 judge Summary

**Every Worker response now carries `x-clickit-runtime: workers`, and four secret-free scripts (`proof-check`, `keys-check`, `media-health --expect-source`, `parse-auth-results`) turn the runbook's outside-in proofs into commands with tested verdicts.**

DNS-02, DNS-03, MAIL-02 and MEDIA-02 are live outcomes and were not ticked in REQUIREMENTS.md (marked after the cutover). STATE.md: only the Phase 3 position line changed; `state.advance-plan` was not run.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Runtime marker header and proof-check | a1786ff | runtime-header.ts, custom-worker.ts, http-pin.mjs, proof-check.mjs, 2 tests |
| 2 | keys-check and media-health --expect-source | 52ef3fe | keys-check.mjs, media-health.mjs, 2 tests |
| 3 | parse-auth-results (MAIL-02 judge) | 4440f20 | parse-auth-results.mjs, test |

Entry gate (`grep -q '^ENTRY: PASS' 03-ENTRY.md`) passed before the first task. 03-02 files (`scripts/cf/*`, `workers/media/*`, `tests/unit/deploy-guard.test.ts`) were not touched.

## What was built

- **runtime-header.ts / custom-worker.ts**: `withRuntimeHeader` copies the response (`new Response(body, response)`, so the stream and immutable-header responses are fine) and sets the header, overwriting any upstream value. A 101 or a response with a `webSocket` is returned untouched. `custom-worker.ts` now has `async fetch(request, env, ctx)` returning `withRuntimeHeader(await handler.fetch(...))`; `scheduled` is unchanged. No build was run (unit-tested only; the custom-worker wiring is checked by a source-pattern test because `.open-next/worker.js` exists only after `cf:build`).
- **http-pin.mjs**: `pinnedRequest(url, { ip, method, headers, body, readBody })` on `node:https`/`node:http` with a `lookup` override (handles the `all: true` form), servername and Host stay the real name, no redirect following, returns `{ status, headers, certificate: { validTo, issuer, subjectaltname } }`.
- **proof-check.mjs**: `--expect worker|vercel` (required), `--site`, `--site-path`, `--apex`, `--media`, `--resolve-ip` (pins only the site host), `--vercel-ip` (adds a rollback line: the old host's certificate notAfter and the ceiling date, notAfter minus 14 days), `--min-cert-days`. Lines: `site`, `cert`, `apex` (301 to exactly `https://www.clickitstory.ae/en`, server cloudflare), `http` (301 to https on apex or www), `media` (404 from cloudflare), then `proof-check <expect>: ALL PASS` or `N FAILED` with exit 1. A request error is a FAIL line, not a crash.
- **keys-check.mjs**: finds the anon token of this project (decoded payload role `anon`, ref equal) and the `sb_publishable_` key, one `apikey`-only REST read per key, judges `legacy-on` (200/200) or `legacy-off` (401/200). `--captcha-probe off|on` sends one password grant for `captcha-probe@example.invalid` with a random password and no captcha token. Every log line goes through `redact()` (8 characters plus length); bodies are scrubbed before printing. It reads no env var, file or Keychain and writes nothing to disk.
- **media-health.mjs**: exported `sourceVerdict(result, expected)` and `parseArgs`; `--expect-source r2|supabase` marks a URL failed with `x-media-source <value>, expected <expected>` (result field `reason`, printed in the line). Without the flag nothing changes.
- **parse-auth-results.mjs**: topmost `Authentication-Results` decides, `ARC-Authentication-Results` ignored, folded and flattened lines joined, comments stripped; SPF needs a pass, DKIM needs a pass aligned to the domain, DMARC needs a pass (and `header.from` equal to the domain when present). CLI prints `SPF:`, `DKIM: ... (d=...)`, `DMARC:`, `MAIL-02: PASS|FAIL` and exit 0/1.

## TDD record

- RED: all test files were written before the modules. The Task 1 pair was run first and failed with `ERR_MODULE_NOT_FOUND` for both targets; for Tasks 2 and 3 the failing run was not executed separately (the modules did not exist, so the import could only fail). GREEN: Task 1 passed 33 of 33 on the first run (35 after adding the `--site-path` cases), Task 2 39 of 39, Task 3 18 of 18 on the first run.
- As in 03-01 and 03-03, tests and implementation were committed together per task, so there is no separate `test(...)` commit; the RED run is recorded here.
- Case counts against acceptance: Task 1 asked for 12 (35), Task 2 for 12 (39), Task 3 for 6 (18). The `media-health-source` tests also run `runMediaHealth` end to end against a local `127.0.0.1` server, with no external network.

## Verification

- `npm run test:unit`: 2157 tests, 2157 pass, 0 fail (2065 before this plan plus 92 new).
- `npm run lint`: 0 errors, 25 warnings (same count as before this plan; none in files added here; the `custom-worker.ts` anonymous-default-export warning pre-dates the plan).
- `npm run typecheck`: clean (exit 0).
- Acceptance greps: `withRuntimeHeader` and `scheduled` in `custom-worker.ts` both present; the key/token regex prints 0 for `keys-check.mjs` and `keys-check.test.ts`; `writeFile|appendFile` 0; `/signup|/recover|/otp|/magiclink` 0. The tests also carry source-scan guards for these. `no-vercel.test.ts` passes (no upper-case VERCEL names; the old host appears only as lower-case `x-vercel-id` strings, which the guard allows).
- `printf` acceptance command for parse-auth-results prints `SPF: PASS`, `DKIM: PASS (d=clickitstory.ae)`, `DMARC: PASS`, `MAIL-02: PASS` (exit 0).
- Read-only live smokes, 2026-10-21 about 15:2x CET, public GET/HEAD and TLS handshakes only:

```
$ node scripts/cutover/proof-check.mjs --expect vercel --vercel-ip 216.198.79.1 --site-path /en/portfolio
PASS site: vercel answer (status 200)
PASS cert: notAfter Dec 29 02:45:11 2026 GMT, 68 days left
PASS apex: 301 to https://www.clickitstory.ae/en
PASS http: 301 to https://clickitstory.ae/
PASS media: bare host answers 404 from cloudflare
PASS rollback: old host certificate for www notAfter Dec 29 02:45:11 2026 GMT (68 days); rollback ceiling 2026-12-15 (notAfter minus 14 days)
proof-check vercel: ALL PASS

$ node scripts/cutover/proof-check.mjs --expect worker --site-path /en/portfolio --resolve-ip 104.21.29.215
FAIL site: x-vercel-id present (old host answered); x-vercel-cache present (old host answered); x-clickit-runtime missing, expected workers
PASS cert: notAfter Jan 18 10:40:53 2027 GMT, 88 days left
PASS apex: 301 ... PASS http: ... PASS media: ...
proof-check worker: 1 FAILED   (correct: Cloudflare is proxying the old host today, exit 1)

$ node scripts/cutover/keys-check.mjs --extract-only --worker-site https://clickit.clickitstory.workers.dev
PASS legacy key found: eyJhbGci... (208 chars) in /_next/static/immutable/chunks/0x__p54n25hit.js
FAIL publishable key not found (searched 24 files)
keys-check extract-only: 1 FAILED   (expected until runbook Step 21 builds with a publishable key)
```

## Not run, by design (hard rules)

- `keys-check --expect legacy-on ...` and `--captcha-probe`: the plan's acceptance asked for a live `--expect legacy-on` smoke (legacy 200), but this session's rule is that no request may carry a Supabase key. Both modes are covered only with fakes (the fakes assert the exact URL, method and header set, and that no output line contains a key). The runbook step that first runs them live belongs to the controller. `--extract-only` stands in for the live smoke of the key finder.
- No build, no wrangler, no deploy, no Cloudflare API call, no DNS change, no secret read.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Second pinned certificate read came back empty**
- **Found during:** Task 1 live smoke (`--vercel-ip` line: "certificate notAfter unreadable")
- **Issue:** Node's shared agent cached the TLS session; on a resumed session `getPeerCertificate()` returns an empty object, so the rollback-ceiling read failed after any earlier request to the same host.
- **Fix:** a fresh `https.Agent({ keepAlive: false, maxCachedSessions: 0 })` per request. Verified with three consecutive reads, each returning the notAfter.
- **Files modified:** scripts/cutover/http-pin.mjs
- **Commit:** a1786ff

**2. [Rule 3 - Blocking] The probe path `/en` does not answer 200 on the live site**
- **Found during:** Task 1 live smoke
- **Issue:** `https://www.clickitstory.ae/en` answers 308 to `/en/portfolio` today, so the planned `site` line (200 required) failed against the old host, and the same would happen on the Worker if it is in a redirecting mode.
- **Fix:** added `--site-path <path>` (default `/en`, as planned); the judge is unchanged (200 only). The apex probe stays `/en` because the apex rule redirects exactly there. Smoke ran with `--site-path /en/portfolio`.
- **Files modified:** scripts/cutover/proof-check.mjs, tests/unit/proof-check.test.ts
- **Commit:** a1786ff

**3. [Rule 3 - Blocking] keys-check must follow the page redirect**
- **Issue:** the planned "GET <www>/en then its chunks" gets a 308 with no body on the live site.
- **Fix:** same-origin redirects are followed (max 5, same IP pin); a cross-origin redirect is an error. Covered by a test using a 308 fixture.
- **Commit:** 52ef3fe

**4. [Rule 2 - Missing critical functionality] `--extract-only` mode**
- **Issue:** with the live keys-check smoke forbidden, nothing would exercise the key finder against a real bundle, the riskiest part of the script.
- **Fix:** `--extract-only` (public GETs only, sends nothing to the API; refuses to combine with `--expect` or `--captcha-probe`). It found the legacy key in the live frozen bundle at the first try.
- **Commit:** 52ef3fe

### Plan interpretation notes (no code/plan disagreement)

- The research suggests asserting "non-2xx" for a deactivated legacy key; the plan truth says 401. Implemented 401; any other status fails with the status in the message. If Supabase answers a deactivated key with 403, the first live `legacy-off` run will FAIL with that number and the judge needs a one-line change.
- `judgeApex` also checks `server: cloudflare` only when the caller asks (`requireCloudflare`, which the CLI does); the pure function with its defaults matches the plan's behaviour list.
- `parse-auth-results` also fails a `dmarc=pass` whose `header.from` is another domain (a pass for another From is no proof for this domain). This is stricter than the plan text, never looser.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-03-17 holds (no key literal, no disk write, no env/Keychain read, redact() and body scrub on every line); T-03-18 holds (only the password grant path exists, no signup/recover/otp/magiclink string in the script, asserted by a source test); T-03-19 holds (marker header and absence of `x-vercel-id`/`x-vercel-cache` both required, proven by a negative live run); T-03-20 holds (stream-preserving copy, 101 untouched, tested); T-03-21 holds (alignment rule).

## Notes for later plans

- Live runs belong to the controller: `keys-check --expect legacy-on|legacy-off`, `--captcha-probe off|on`, and the first `proof-check --expect worker` after the Worker carries the header (the header only exists after the next `cf:build` and deploy; today every Worker answer on workers.dev lacks it, so a pre-flip `--expect worker --site https://clickit.clickitstory.workers.dev` will FAIL on the marker until then).
- `keys-check` needs the Worker site's bundle to hold the publishable key: that happens at runbook Step 21 (build with a publishable key).
- Runbook should pass `--site-path` that answers 200 in the site's current mode (coming-soon redirects change `/en`).
- The Vercel certificate of www expires Dec 29 2026; the proof-check rollback line prints the ceiling (2026-12-15 for that certificate).

## Self-Check: PASSED

All twelve created and modified files exist, and commits a1786ff, 52ef3fe and 4440f20 are in `git log`.
