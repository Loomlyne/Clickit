# MEMORY

## Project
- Name: Clickit
- Stack: Next.js 16, TypeScript, Supabase, Vercel
- Repo path: `/Users/koss/Desktop/Develop/Clickit`

## Session 2026-04-05
- Investigated "broken MCPs" from the local Codex setup rather than app code.
- Verified working MCPs in-session: Figma, Notion, Chrome DevTools, Linear plugin tools.
- Confirmed broken raw MCP entries in `~/.codex/config.toml`:
  - `mcp_servers.linear` failed MCP handshake with a Cloudflare Worker 1101 error.
  - `mcp_servers.invios` failed startup/response decoding and did not surface usable tools.
  - Chrome DevTools was registered twice as `chrome-devtools` and `chrome_devtools`.
- Applied config cleanup:
  - Removed raw `linear` MCP entry.
  - Removed raw `invios` MCP entry.
  - Removed duplicate `chrome-devtools` entry and kept `chrome_devtools`.
  - Backup created at `~/.codex/config.toml.bak-20260405-005457`.

## Notes
- A repeated warning still exists from overlapping plugins exposing the same Vercel MCP server:
  - `vercel@openai-curated`
  - `build-web-apps@openai-curated`
- That warning is plugin-level duplication, not a broken app repo file.
- Codex restart is required for the cleaned MCP config to fully take effect.

## Session 2026-04-06
- Created redesign work on branch `codex/redesign-preview`.
- Added repo-level `DESIGN.md` that defines the new Clickit visual system:
  - Apple-style restraint for viewer surfaces
  - Linear-style precision for admin surfaces
  - Inter-only primary typography
  - near-black shell + restrained indigo accent
- Reworked shared UI tokens and primitives in `src/styles/globals.css` and `src/components/ui/*` to standardize buttons, cards, inputs, dialogs, sheets, tables, tabs, badges, and dropdown surfaces.
- Redesigned viewer-facing shared chrome and major public routes:
  - navbar, footer, section headers
  - home hero and rails
  - auth, search, my-list, profile, support, coming-soon
  - series detail and watch surfaces
- Redesigned admin shell and management flows:
  - admin header and route headers
  - shows/archive tables
  - show detail / season / episode management surfaces
  - admin drawers and upload zones
- Rebuilt `/design-system/*` pages so docs now reflect the active redesign tokens and component rules.
- Verified remote Vercel build success on preview deployments.
- Current ready deployment:
  - public-style preview URL attempted: `https://clickit-5ql1rhktf-koussays.vercel.app`
  - inspector: `https://vercel.com/koussays/clickit-cit/p2q15gyrRMPNyFpFiiYtMcjHa5Bt`
- Important deployment note:
  - The project has Vercel Authentication / Deployment Protection enabled on preview URLs, so opening the raw preview URL in a fresh browser redirects to Vercel login.
  - To share a no-login review link for this exact preview, create a Shareable Link from the Vercel dashboard deployment page and set access to `Anyone with the link`.
- AIDesigner CLI setup was attempted and MCP login succeeded, but CLI generation still reported missing auth in this session, so the redesign was implemented directly in the codebase using the agreed Apple + Linear system instead of generated comps.
- Applied three follow-up cleanup tweaks from screenshot review:
  - removed duplicate hover text from the landscape show card overlay so only the play button appears on hover
  - adjusted the genre pill section spacing so hover movement is no longer clipped
  - removed the navbar tagline plus `Home`, `Coming Soon`, and `Support` pills from the navbar on all breakpoints
- Latest preview deployment for the cleanup pass:
  - preview URL: `https://clickit-5hhev5v6w-koussays.vercel.app`
  - inspector: `https://vercel.com/koussays/clickit-cit/DXonnYRDVvwxUYr4wTPNjRyN36F9`
- Applied follow-up series hero cleanup for `/series/[slug]`:
  - removed the heavier cinematic backdrop treatment from the series hero
  - switched to a cleaner full-bleed hero image with restrained dark overlays
  - kept the content structure and CTA behavior intact while making the background match the simpler reference look
- Latest preview deployment for the series hero pass:
  - preview URL: `https://clickit-3kpc5jith-koussays.vercel.app`

## Session 2026-04-08
- Persisted a browser-preview UI tweak in `src/components/shows/show-card.tsx`.
- Removed the small uppercase genre label from the viewer home rail `ShowCard` header, leaving only the title and rating in the card metadata row.
