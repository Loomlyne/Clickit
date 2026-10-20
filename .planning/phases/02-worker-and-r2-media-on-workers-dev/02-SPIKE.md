# Phase 2 spike (plan 02-01)

## Precondition

Checked 2026-10-20 by work session C (Cloudflare move).

| Item | Value |
|------|-------|
| Branch | `claude/phase-02-execute-19d86a` (cut from `phase-02-workers-r2`) |
| HEAD before this file | `4185d94eebf9d4ea6e942348afc72866b86490c8` |
| origin/main | `ea94b9600cddfc2443eae39e53eccac4097a2cc2` |
| origin/phase-01.1-admin-actions-hardening-inserted | `f793b319f7e77f2333b9684d9b50789e77be9e7d` (merged in as `e17f63f`) |

| Check | Result |
|-------|--------|
| (a) origin/main is an ancestor of HEAD | pass |
| (b) Phase 01.1 code on HEAD: `checkImageUpload` in `src/lib/admin/media-guards.ts`, `saveHeroVideoCore` in `src/lib/admin/hero-video.ts`; 01.1 commits e.g. `81bcc3a fix(01.1-12)`, `3c7a5f4 feat(01.1-12)`, `d834b92 feat(01.1-11)` | pass on HEAD. **Deviation:** 01.1 is not on origin/main yet (code done, UAT pending); it was merged from its phase branch on the controller's instruction. When 01.1 lands on main, merge origin/main again. |
| (c) branch is not main | pass (name is `claude/phase-02-*`, not one of the listed names; accepted, it is the phase-02 work branch) |
| (d) working tree clean apart from .planning | pass |

## Package legitimacy

`npm view` on 2026-10-20 (all versions still current: @opennextjs/cloudflare 1.20.12, next 16.4.2, wrangler 4.151.2 are `latest`):

| Package | Version | Repository | Maintainers | postinstall | install |
|---------|---------|------------|-------------|-------------|---------|
| @opennextjs/cloudflare | 1.20.12 | github.com/opennextjs/opennextjs-cloudflare | 1 | none | none |
| wrangler | 4.151.2 | github.com/cloudflare/workers-sdk | 1 | none | none |
| aws4fetch | 1.0.20 | github.com/mhart/aws4fetch | 1 | none | none |
| @marsidev/react-turnstile | 1.6.2 | github.com/marsidev/react-turnstile | 1 | none | none |
| sharp | 0.35.5 | github.com/lovell/sharp | 1 | none | none |
| next | 16.4.2 | github.com/vercel/next.js | 4 | none | none |
| react | 19.2.9 | github.com/react/react | 2 | none | none |
| react-dom | 19.2.9 | github.com/react/react | 2 | none | none |

Note: react and react-dom now list `github.com/react/react` as repository (older releases said `facebook/react`); worth a look in step 6.

Koss's answer (controller's question form, 2026-10-20, relayed by the Clickit controller): "Approve as listed". Controller instruction: pin exact versions in package.json and commit the lockfile. No npm install ran before this answer.
