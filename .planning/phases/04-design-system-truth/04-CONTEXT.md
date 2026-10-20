# Phase 4: Design System Truth - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning on the recommended answers. NOT SIGNED: every D-01..D-08 below is the recommended option of `04-DISCUSS-QUESTIONS.md` and waits for Koss's answer (via the controller). If an answer differs, the plans named in `04-GATE.md` change before execution.

<domain>
## Phase Boundary

Phase 4 writes down and enforces the look the live site already has, and produces the signed Claude Design canvas that Phases 5-7 build from. It delivers:
1. Tokens: `src/styles/globals.css` + `ui.config.json` as the only source of colours, radii and shadows; one brand-colour map in `src/lib/brand-colors.ts`; a guard in `gate:local` that fails on new hard-coded hex, bracket radii or bracket shadows outside the token files.
2. Docs: DESIGN.md matching the live tokens (it nearly does already) plus the new rules (email tokens, YouTube-rules player chrome, RTL, radius roles).
3. An admin-only in-app page that renders the live tokens (DS-01, DS-04).
4. A Claude Design canvas with foundations, viewer, admin and email boards, signed by Koss (DS-03).

Not in this phase: building the OTP sign-in, emails, import or inbox screens in code (Phases 5-7); any database write; any deploy. The live site must look unchanged except the three leftovers in D-03.

</domain>

<decisions>
## Implementation Decisions

### Colour truth
- **D-01 (Q1, recommended A):** Page background is **#090909** (`--bg-0`), as live. The roadmap/requirement wording "#0a0a0a" is corrected to #090909. The two stray `#0a0a0a` literals (`src/app/[locale]/(viewer)/layout.tsx:41` preload cover, `src/components/layout/user-avatar.tsx:25` initials ink) become `var(--bg-0)` / `var(--primary-foreground)`.
- **D-03 (Q3, recommended A):** The three blue-era leftovers snap to tokens: `ui/select.tsx` popover `bg-[#11151d]/98` → `bg-[var(--bg-1)]`; the Sonner toaster in `src/app/[locale]/layout.tsx:153` `bg-[#10131a]` → `bg-[var(--bg-1)]`; `landing-hero-animations.tsx:53` hover `#7082ff` + indigo glow `rgba(96,115,255,.28)` → `var(--uis-primary-hover)` + `rgba(255,204,0,.18)` glow (as a token). These are the only intended visible changes.
- **D-04 (Q4, recommended A):** Category colours (`public.categories.color`, 15 live rows, all admin-picked non-brand hex) are content and stay free; the category colour picker stays. Exempt in the guard: values read from data. Everything else uses one brand map: the 6 CIT colours (`brand-blue/purple/green/red/orange/sand`) + safe tints, exported once from `src/lib/brand-colors.ts`. Shows keep their 5-value `brand_color` enum (no migration); Desert Sand is available to genres/categories defaults only.

### Shape truth
- **D-02 (Q2, recommended A):** Radius roles stay as the UI System engine outputs for `roundness 50, pill true, field 8`: chip/control/shell 999px, field 8px, card 12px, media 11px, panel 16px, `--radius` 8px. "8px base radius" in the roadmap means field/base. Bracket radii in `src/` become named Tailwind utilities backed by these tokens (see Claude's discretion).

### In-app page
- **D-05 (Q5, recommended A):** One read-only page at `/[locale]/admin/design-system` inside the existing admin layout (guard: `app_config.admin_user_id`, redirect to `/watch`; Phase 5's `requireAdmin` + TOTP replaces it without changes here). It reads the CSS custom properties at runtime (`getComputedStyle`) for swatches, and renders LBC type scale (EN + AR), radius roles and the real `Button`/`Input`/`Badge` primitives. Linked from the admin sidebar. No `/design-system` top-level route is added back; DS-01/DS-04 wording is updated to `/admin/design-system`.

### Claude Design canvas
- **D-06 (Q6, recommended A):** A new Claude Design canvas "Clickit Story" (Artifact, Design type) that installs the published "UI System" design system (claude.ai/artifact/XTKikX3yqayDRfUixvkNrS) with `UIS.Root primary="#ffcc00" accent="#ffcc00" neutral="#737373" mode="dark" roundness=50 pill field=8 surface="glass"` and LBC loaded from the canvas assets. Four groups: Foundations (colour + brand map, type EN + AR, radius + surfaces, components), Viewer (email-code sign-in incl. 6-digit entry and Arabic-Indic digits, home + show, watch page per YouTube RMF — nothing over the playing video, Arabic RTL of home + watch), Admin (playlist import preview, inbox), Email (sign-in code, confirm/reset/email-change, welcome, new-episodes digest, support auto-reply). Phase 6's signed pictures (import sheet, stacked watch page, up-next card) are reproduced unchanged, not redesigned. The existing brand-neutral UI System canvas is not edited.
- **D-07 (Q7, ANSWERED by Koss 2026-10-20 as Phase 5 Q12 — option C):** Emails follow the reader's system colour scheme: light by default (black header bar with the logo, white body/card, yellow #ffcc00 button with #090909 ink) and a dark version through `@media (prefers-color-scheme: dark)` that is black like the site (#090909 page, #101010 card). Phase 5 owns the email templates and their picture. Phase 4 supplies email-safe tokens for BOTH schemes as literal hex values (no CSS variables — mail apps drop them), in DESIGN.md and in one token module (e.g. `src/lib/email-tokens.ts`, allowlisted in the lint rule), so Phase 5 imports them. The canvas Email group shows Phase 5's signed email picture in both schemes, reproduced, not redesigned. Copy is Phase 5's.
- **D-08 (Q8, recommended A):** Koss signs four groups separately (Foundations, Viewer, Admin, Email) in `04-GATE.md` with date. A later phase may code a screen once its group is signed.

### Claude's Discretion
- Guard mechanism: a Node script `scripts/check-design-tokens.mjs` wired into `gate:local` (and the PR CI that runs `gate:local`), with an allowlist file for the token files, `src/lib/brand-colors.ts`, data-driven colours (categories, show artwork), and email templates.
- Named radius utilities in `@theme`: `rounded-chip`, `rounded-control`, `rounded-field`, `rounded-card`, `rounded-media`, `rounded-panel` mapped to `--uis-r-*`; named shadows `shadow-soft`, `shadow-panel`, `shadow-popover` mapped to existing `--shadow-*` tokens.
- `white/NN` and `black/NN` alpha utilities (383 uses) are neutral overlays, not brand colours: they stay, and the guard does not flag them. Raw Tailwind palette classes (`bg-red-500`, 4 uses) are replaced with tokens.
- Token pinning: a unit test reads `globals.css` and asserts the signed values (D-01, D-02, primary, fonts) so a silent change fails `gate:local`. A second test re-derives the radius roles from `ui.config.json` with the same formula as `Loomlyne/ui-system` `packages/core/src/radius.ts` (vendored as a small pure function, no new dependency).
- Avatar initials gradient (`#c8a04a → #d97757`) moves to `--chart-5`/`--chart-2` tokens (no visible change).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` §Phase 4 — goal, success criteria 1-4, owner gates
- `.planning/REQUIREMENTS.md` — DS-01..DS-04 (lines 107-110)
- `.planning/phases/04-design-system-truth/04-DISCUSS-QUESTIONS.md` — the 8 questions and recommended options
- `.planning/phases/04-design-system-truth/mockups/04-q1.png` … `04-q7.png` and `04-mockups.html` — option pictures

### Tokens and engine
- `src/styles/globals.css` — live tokens (`:root`, `.dark`, `@theme inline`, `@theme`)
- `src/styles/admin.css` — admin styles (0 hex today)
- `ui.config.json` — UI System seed for Clickit
- `DESIGN.md` — design doc (already on the live values; update, do not rewrite)
- GitHub `Loomlyne/ui-system`: `packages/core/src/radius.ts`, `theme.ts`, `type.ts`, `config.ts`; `docs/claude-design.md` (how canvases install the design system)
- `src/lib/brand-colors.ts` — the brand map to make the only one

### Cross-phase contracts
- Branch `phase-06-youtube-import-player`: `.planning/phases/06-youtube-import-and-player/06-UI-SPEC.md` — uses #090909, pill/8/12/11/16 radii, LBC 400/700, 11px minimum, `rounded-[12px]` / `rounded-[11px]` / `rounded-[16px]` bracket radii (conflict list in `04-GATE.md`)
- Branch `phase-06-youtube-import-player`: `mockups/06-q1.png`, `06-q8.png`, `06-q9.png`, `06-q11.png`, `06-q13.png`, `06-q15.png` — signed pictures to reproduce in the canvas
- Memory: `ui-system-is-the-repo` — "design system" = Loomlyne/ui-system + the Claude Design artifacts; UI System canvas https://claude.ai/artifact/SqnaiuSLGdB9Q9GNrau13X

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/*` (shadcn primitives already tokenised in #17-#22): Button (min-h-11, pill), Input (8px field), Badge, Select, Sheet, Dialog, Table — render these on the admin page.
- `src/fonts/lbc-regular.woff2`, `lbc-bold.woff2` — LBC 400 and 700 only (no 500/600).
- `src/app/[locale]/admin/layout.tsx` — admin guard to inherit.
- `src/components/admin/admin-header.tsx` — sidebar nav to add the entry to.

### Established Patterns
- Tokens are CSS custom properties consumed as `bg-[var(--bg-1)]`, `text-[var(--text-dim)]`, `border-[var(--line)]`.
- Arabic pages strip bracket `tracking-[…]` via a global rule in `globals.css`.
- next-intl messages in `src/messages/{en,ar}.json` for any new UI text.

### Integration Points
- `package.json` `gate:local` = lint + typecheck + unit + migration guard + build: the token guard joins here.
- Hard-coded hex today (13 files): `admin/settings/genre-color-editor.tsx`, `admin/shows/[id]/edit/page.tsx`, `lib/brand-colors.ts`, `layout/user-avatar.tsx`, `admin/categories-manager.tsx`, `ui/select.tsx`, `profile/profile-history-row.tsx`, `primitives/glow-badge.tsx`, `landing/landing-hero-animations.tsx`, `landing/genre-pills.tsx`, `home/genres-grid.tsx`, `app/[locale]/layout.tsx`, `app/[locale]/(viewer)/layout.tsx`.

</code_context>

<specifics>
## Specific Ideas

- Live check 2026-10-20: `www.clickitstory.ae` CSS has `--bg-0:#090909`, `--primary:#fc0`, `--radius:8px`, `--uis-r-control:999px`, `--uis-r-card:12px`, LBC font; one indigo rule left (`#6073ff47` shadow from `landing-hero-animations.tsx`).
- Live categories (read-only, 2026-10-20): 15 rows, colours #B71C1C, #E18709, #D8DCE4, #206A23, #8D6E63, #00FFFB, #D81B60, #8E24AA, #3949AB, #0288D1, #00897B, #00FF0D, #CC0000, #783AB6, #FDD835. Shows: brand-green 5, brand-blue 4, brand-purple 3, brand-orange 2, brand-red 1.

</specifics>

<deferred>
## Deferred Ideas

- Generating `globals.css` from `ui.config.json` with the ui-system CLI (needs ui-system local-font support first; today the values were applied by hand and are pinned by tests).
- A light theme: not in scope (dark only).
- Moving category colours to the brand map (Q4 B) — only if Koss picks it; it needs a live write.

</deferred>

---

*Phase: 04-design-system-truth*
*Context gathered: 2026-10-20 (recommended answers, pending Koss)*
