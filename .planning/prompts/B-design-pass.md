# Job B: design-system pass, one page group per session (B1–B4)

Base: branch `ui-system-home` (PR #17: UI System tokens + home page). B4 also merges `phase-01.1-admin-actions-hardening-inserted` (it rewrites the same admin files). When #17 / 1.1 land on main, merge `origin/main` in.

Seed: `ui.config.json`, tokens in `src/styles/globals.css`, components `src/components/ui`. Reference engine: github.com/Loomlyne/ui-system (`packages/core/src` radius.ts, type.ts, theme.ts). DESIGN.md rules: 44px touch targets, no text under 11px, 4.5:1 contrast, radius roles. DESIGN.md is stale on colour/font: the code + ui.config.json win.

Groups:
- B1 viewer: `(viewer)/browse`, `(viewer)/series/[slug]`, `(viewer)/watch`, `(watch)/watch/[episodeId]`, `(viewer)/my-list`
- B2 account: `(viewer)/auth`, `(viewer)/auth/reset-password`, `(viewer)/profile`
- B3 info: `(viewer)/about`, `(viewer)/legal/[slug]`, `(viewer)/privacy`, `(viewer)/terms`, `(viewer)/support`, `(viewer)/updates`, `(viewer)/coming-soon`, `(viewer)/portfolio` leftovers. Also: decide if `(viewer)/design-system/*` demo routes are dead (no links, no nav); if dead, delete them in this PR and say so.
- B4 admin: every `admin/*` page (admin, archive, audit, categories, inbox, inbox/[id], reviews, settings, shorts, shows/[id], shows/[id]/edit, shows/new). Tone: calm control room, dense tables.

Steps:
1. Audit your pages against the tokens and rules: list every violation (size, contrast, target, radius, off-token colour) with file:line.
2. ONE before/after picture covering all your pages: a self-contained HTML file at `.planning/design/<group>-before-after.html` using the real CSS variables (copy them from globals.css), real component markup, real copy. Per page: before (as coded today) and after. Phone (375) and desktop (1280) widths. No Supabase env exists locally: mock data in the real data shape.
3. Stop: `NEEDS KOSS: sign <group> before/after — <path>` with a 5-line summary of what changes. Wait.
4. After the controller relays the signature: code exactly what was signed, commit on your branch, `gate:local` under the lock, open ONE PR titled `design(<group>): UI System pass`, hand-over file, report.
Scope: only your group's pages and the components only they use. A shared component change (button, input, card) goes in your report for the controller to sequence; do not edit `src/components/ui/*` unless your prompt says so. B2 owns password fields (eye toggle on every one).
