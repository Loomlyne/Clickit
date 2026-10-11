<!-- GSD:project-start source:PROJECT.md -->
## Project

**Clickit Story (CIT)**

A Netflix-style streaming platform for Clickit Story, a UAE digital media company (Spacelight Studios FZ LLC, Abu Dhabi) with 15 original programs. Viewers sign up, discover a show, pick an episode and watch it through an embedded YouTube player; two admins (Issam Dridi, Nejib Challakhi) upload to YouTube and connect episodes to the platform. This milestone takes the live app off Vercel onto Cloudflare + Supabase and finishes it for production.

**Core Value:** A signed-in viewer opens a show and an episode from YouTube plays immediately, with progress remembered — and the admin can put a whole YouTube season on the platform from one playlist link.

### Constraints

- **Stack**: Next.js 16 App Router + Supabase (auth + Postgres) + Tailwind v4, hosted on Cloudflare Workers — client and Koss's standard stack
- **Video**: YouTube embed only — no video hosting cost or infrastructure
- **Data safety**: never wipe the live Supabase DB; live DB writes, DNS, secrets, emails to real people are owner-gated, one numbered step each
- **Process**: Koss signs discuss, plan, UAT and ship; this session is the control session (only one that commits to main and deploys)
- **Accounts**: Cloudflare work only in the ClickitStory account; never the default (Vamos) wrangler login
- **Cost**: free tiers first; any paid Cloudflare feature (Images) priced and agreed with Koss before enabling
- **Timeline**: no fixed date — order by risk
<!-- GSD:project-end -->

## Deployment Notes

- **Vercel deploys silently block on git author identity — and the obvious fix is paywalled.** All commits push as GitHub user `Loomlyne` (`223640340+Loomlyne@users.noreply.github.com`), which is not a member of the `clickit-s-projects` Vercel team that owns this project. Builds succeed fine (`readyState: READY` on the build sub-resource within seconds), but the deployment itself sits at `readyState: BLOCKED` and never promotes to production — indefinitely, not just slow. Reproduces identically via git push or `vercel deploy --prod` from the CLI. Confirmed in the dashboard: deployments show "Blocked" with tooltip "loomlyne is not a member of this team." `clickit-s-projects` is on the free **Hobby plan**, which caps the team at one member and gates "Invite Members" behind a Pro upgrade — so the obvious fix (add Loomlyne to the team) isn't available without paying. `clickitstory@gmail.com` also has no GitHub account connected. Real options: (1) upgrade to Pro and invite `koussay.zayani0@gmail.com`, or (2) connect a GitHub identity to `clickitstory@gmail.com`'s Vercel account, add it as a `Loomlyne/Clickit` collaborator, and switch git's local push credentials to it. Deployment Protection ("Vercel Authentication") is a separate, unrelated setting on this project — it gates viewing raw `*.vercel.app` URLs, not this.
- **`vercel ls`/`vercel inspect` human-readable output always shows `UNKNOWN` status** for this project's access token — it can list deployments/URLs but not resolve the real state in that view. Use `vercel inspect <url> --format json` to see the actual `readyState`.
- Raw `https://clickit-xxxxx-clickit-s-projects.vercel.app` per-deployment URLs are gated behind Vercel's own auth (return HTTP 200 serving a "Redirecting..." login page, not real app content) — checking status codes against them proves nothing. Verify against the real production domain (`www.clickitstory.ae`) instead.

## Stack
See `.planning/research/STACK.md` (read on demand; not copied here).

## Architecture
See `.planning/research/ARCHITECTURE.md` (read on demand; not copied here).

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

## Skills
Project skills live in `.claude/skills/`; load on demand.

