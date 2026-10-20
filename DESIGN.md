# Clickit Design System

## Direction

Clickit should feel like a premium streaming product: cinematic on the viewer side, calm and operational on the admin side.

- Viewer experience: immersive, content-led, dark cinematic, UAE cultural identity
- Admin experience: precise, dense, calm, tool-like
- Core rule: show artwork carries the expressive color; product chrome stays disciplined
- Hero layout anchors content bottom-left, cinematic, not centered

## Source of Truth

The look comes from UI System (github.com/Loomlyne/ui-system), seeded by `ui.config.json` at the repo root. Engine values were applied on 2026-10-20 to `src/styles/globals.css`. `--uis-*` aliases in `:root` exist for future UI System components and point at the existing tokens. To regenerate, re-run `buildTheme` on `ui.config.json` and re-apply the values.

Signed values are pinned in `src/lib/design-truth.ts` and `tests/unit/design-tokens.test.ts`. The tables below are pinned against `src/styles/globals.css` by `tests/unit/design-doc.test.ts`, so this file cannot drift from the tokens. The in-app view is `/[locale]/admin/design-system` (admin only). The design canvas is the private canvas "Clickit Story".

Guard: ESLint rule `clickit/no-raw-design-values` flags raw hex, non-neutral `rgb()`, bracket radii, bracket shadows and raw Tailwind palette classes in `src/` outside `src/lib/brand-colors.ts`, `src/lib/design-truth.ts`, `src/lib/email-tokens.ts` and email templates (it is an error once the Phase 4 codemod has landed). `white/NN` and `black/NN` overlays are allowed.

## Mode and Color

- The app is dark mode only. Emails follow the reader's colour scheme (see Email).
- Primary and accent: `#ffcc00` yellow, with dark ink `#090909`
- Danger: `#ff3b30`
- Neutral seed: `#737373`

| Token | Value | Role |
|-------|-------|------|
| `--bg-0` / `--background` | `#090909` | App canvas, sidebar |
| `--bg-1` / `--card` / `--popover` | `#101010` | Cards, popovers |
| `--bg-2` / `--secondary` / `--muted` | `#191919` | Secondary and muted surfaces |
| `--bg-3` | `#2A2A2A` | Raised surface |
| `--bg-4` | `#424242` | Strong surface, strong line |
| `--text` / `--foreground` | `#F4F4F4` | Primary text |
| `--text-dim` / `--muted-foreground` | `#CCCCCC` | Secondary text |
| `--text-mute` | `#A1A1A1` | Tertiary text, captions |
| `--primary` | `#ffcc00` | CTA, focus, accent |
| `--primary-foreground` | `#090909` | Ink on primary |
| `--line` | `rgba(255,255,255,0.08)` | Hairline border |
| `--line-2` | `rgba(255,255,255,0.14)` | Strong border |
| `--destructive` | `#ff3b30` | Danger actions and states |
| `--ring` | `rgba(255,204,0,0.5)` | Focus ring |
| `--uis-primary-hover` | `#D7AD16` | Primary hover (UI System) |
| `--uis-primary-soft` | `#312915` | Soft primary tint (UI System) |

## Typography

- Local LBC font for titles, body and UI, in English and Arabic. The `modern` preset in `ui.config.json` is a placeholder until ui-system supports local fonts; no font comes from the engine.
- Logo mark: Arthead FREE for the "story" portion of the wordmark
- New screens use 11 / 14 / 20 / 24 at weight 400 or 700. The wider scale (13, 15, 16, 30, 36+) describes the viewer pages that exist today and is not extended.
- LBC has only 400 and 700 files; 500 renders as 400 and 600 as 700.
- Nothing under 11px

## Radius Roles

`--radius` 8px is the field/base radius; controls are pills (D-02). Use the named utility, never a bracket value.

| Role | Utility | Token | px | Use |
|------|---------|-------|----|-----|
| `chip` | `rounded-chip` | `--uis-r-chip` | 999 | Chips and badges |
| `control` | `rounded-control` | `--uis-r-control` | 999 | Buttons and controls |
| `shell` | `rounded-shell` | `--uis-r-shell` | 999 | Navigation shells |
| `field` | `rounded-field` | `--uis-r-field` | 8 | Inputs and selects |
| `card` | `rounded-card` | `--uis-r-card` | 12 | Cards and panels |
| `media` | `rounded-media` | `--uis-r-media` | 11 | Thumbnails, artwork |
| `panel` | `rounded-panel` | `--uis-r-panel` | 16 | Sheets and dialogs |
| `hairline` | `rounded-hairline` | `--radius-hairline` | 1 | Support page 3px bars only |

Standard scale (unchanged): `rounded-sm` 4px, `rounded-md` 6px, `rounded-lg` 8px, `rounded-xl` 10px, `rounded-2xl` 12px.

## Shadows

Named utilities; the values live in `globals.css` (`@theme static`), so `shadow-[var(--shadow-soft)]` style uses still work. No bracket shadow in `src/`.

| Utility | Value | Use |
|---------|-------|-----|
| `shadow-soft` | `0 24px 80px rgba(0,0,0,0.38)` | Menus on pages |
| `shadow-panel` | `0 10px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)` | Panels |
| `shadow-popover` | `0 24px 80px rgba(0,0,0,0.42)` | Select menus and toasts |
| `shadow-modal` | `0 40px 120px rgba(0,0,0,0.6)` | Full-screen overlays |
| `shadow-bar` | `0 8px 32px -8px rgba(0,0,0,0.65)` | Watch page control bar |
| `shadow-inset-hairline` | `inset 0 1px 0 rgba(255,255,255,0.04)` | Select fields and checkboxes |
| `shadow-live-dot` | `0 0 6px rgba(239,68,68,0.9)` | Live dot in the navigation |
| `shadow-cta-glow` | `0 16px 40px rgba(255,204,0,0.18)` | Landing "Browse shows" link hover |
| `drop-shadow-splash` | `0 24px 80px rgba(0,0,0,0.55)` | Coming-soon logo |

## Status tones

State colour comes from four tones. Same colours as the brand safe tints and the neutral text and line tokens.

| Tone | Token | Classes |
|------|-------|---------|
| `success` | `--status-success` | `text-status-success`, `border-status-success/35`, `bg-status-success/8` |
| `warning` | `--status-warning` | `text-status-warning`, `border-status-warning/35`, `bg-status-warning/8` |
| `danger` | `--status-danger` | `text-status-danger`, `border-status-danger/35`, `bg-status-danger/8` |
| `neutral` | `--status-neutral` | `text-status-neutral`, `border-status-neutral-line` |

`brand-*-safe` classes keep working; new code uses `status-*` for state.

## Exact legacy tokens (kept so nothing visibly changes)

These hold the exact values older screens already render, so the token codemod changes no pixel. Use them as `rgb(var(--ink-legacy-rgb) / 0.96)`; do not add new uses.

| Token | Value | Used for |
|-------|-------|----------|
| `--ink-legacy-rgb` | `10 10 10` | Hero and series gradients, navbar scrims, category chips |
| `--ink-cinema-rgb` | `8 8 12` | Cinematic gradients in `src/lib/cinema.ts` |
| `--ink-scrim-rgb` | `4 6 10` | Dialog and sheet scrims |
| `--primary-rgb` | `255 204 0` | Yellow glow inside gradients |
| `--live-dot` | `oklch(63.7% 0.237 25.331)` | Navbar live dot (`bg-live-dot`) |
| `--scrim-nav` | `rgb(var(--ink-legacy-rgb) / 0.96)` | Navbar bar |
| `--gradient-nav-fade` | `linear-gradient(180deg, rgb(var(--ink-legacy-rgb) / 0.95), rgb(var(--ink-legacy-rgb) / 0.65))` | Navbar fade |
| `--scrim-dialog` | `rgb(var(--ink-scrim-rgb) / 0.82)` | Dialog overlay |
| `--scrim-sheet` | `rgb(var(--ink-scrim-rgb) / 0.8)` | Sheet overlay |

## Surfaces

- Hairline borders, glass float for overlays, medium shadow
- Density: comfortable
- Controls use a 44px touch target (`min-h-11` on default and lg buttons)
- Navigation: front bar, back (admin) sidebar

## CIT Brand Colors (show identity only)

- Innovative Blue `#2c3569` (safe `#8d9cff`)
- Royal Purple `#9f54a0` (safe `#c592ff`)
- Oasis Green `#50a258` (safe `#77d586`)
- Crimson Red `#db3f34` (safe `#ff8b82`)
- Sunset Orange `#ea8c2e` (safe `#ffb46e`)
- Desert Sand `#f8c623` (safe `#f8d86f`)

Brand colors are for show identity, category ribbons and hover glows only, never global chrome, buttons, layout backgrounds or form chrome. Safe tints are used for metadata badges, status cues and card glow.

The map lives in `src/lib/brand-colors.ts` (`BRAND_PALETTE`). Desert Sand's class is `brand-yellow` (`--color-brand-yellow`). Shows use the five show keys only; Desert Sand is for genre and category defaults. Category colours are admin-picked content and are not part of the map (D-04).

Harmony: Royal Purple + Oasis Green; Crimson Red + Desert Sand; Royal Purple + Sunset Orange. Innovative Blue + White are neutral and pair with any set.

## Motion

- Use 180-260ms transitions for hover, focus, and reveal states
- Prefer opacity and transform transitions
- Respect `prefers-reduced-motion` — gate animations and video autoplay accordingly
- Avoid exaggerated scale or parallax on core navigation and admin UI
- Hero entrance animations use cinema-curve easing at 500-600ms

## Viewer Rules

- Hero areas present one show at a time, anchored bottom-left, with CTA focus
- Card glow effects use per-show brand color at reduced opacity on hover
- Metadata reads as editorial product information — uppercase labels, clean hierarchy
- Content rails scroll horizontally, touch/swipe friendly
- UAE-inspired pattern ribbons on category and show branding

## Admin Rules

- Admin pages feel like a calm control room
- Compact panels, quiet stats blocks, strong table hierarchy, clear actions
- Tables, forms, sheets, and drawers share the same token system as the viewer shell
- Keep status color purposeful and sparse
- Media pickers use the same upload pattern as ArtworkUploadZone (form-state, not save-first)

## Component Rules

- Buttons: yellow primary with dark ink, subdued secondary, translucent outline, minimal ghost; default and lg at least 44px tall
- Inputs: dark filled fields with restrained borders (8px radius) and strong focus rings
- Cards: dark surfaces (12px) with hairline outline and brand color glow on hover
- Tables: uppercase headers, airy rows, clear hover and selection states
- Drawers and dialogs: darker overlays, framed panels, generous spacing

## Patterns

UAE-inspired patterns for category ribbons and show branding:
- Islamic geometric patterns (Oasis Green, Royal Purple)
- Arabic calligraphy motifs
- 3D geometric / parametric patterns (Innovative Blue)
- Abu Dhabi skyline silhouette (Crimson Red)

Each program gets a branded ribbon — pattern + color combination from the 5 brand colors.

## Hero Media

Each show can have per-responsive-variant hero media:
- Desktop: 16:9 image (1920×1080) or landscape MP4/YouTube video
- Mobile: 9:16 image (1080×1920) or portrait MP4/YouTube video
- Fallback chain: mobile video → desktop video → mobile image → desktop image → bloom only
- Video backgrounds are muted and autoPlay (respect `prefers-reduced-motion`)

## Accessibility

- Every text/background pair meets 4.5:1 (WCAG AA); muted text `#A1A1A1` on `#090909` is at least 7:1
- Maintain 44x44px touch targets where interaction is primary
- Visible keyboard focus for all interactive elements
- Never encode meaning with color alone
- Decorative backgrounds and video layers use `aria-hidden`
- Respect `prefers-reduced-motion`: disable Ken Burns, reduce animation, pause video autoplay

## Watch page and YouTube rules

No element is ever drawn over any pixel of the YouTube iframe while it is mounted and visible: no top bar, arrow, tray, overlay, gradient, tooltip, toast, focus ring, hit-area pseudo-element, skeleton or loading tint. The player box contains the iframe and nothing else.

Up-next and error cards replace the iframe; no Toaster on the watch route.

## Right-to-left

- Logical utilities only: `ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `text-start`, `border-s`. No `left-`, `right-` or `text-left` in new code.
- Tokens, hex values, codes and titles sit inside `<bdi>` or `dir="ltr"` so they never reorder inside Arabic text. Code inputs stay LTR inside Arabic pages.
- Letter spacing uses the bracket form `tracking-[…]` so the Arabic rule can strip it.
- Chevrons use `rtl:rotate-180`.
- Named exception: the password show/hide eye stays on the physical right in both languages (owner rule).

## Email (Q7 = C, Koss 2026-10-20)

Emails follow the reader's system colour scheme: light by default, dark via `@media (prefers-color-scheme: dark)`. Phase 5 owns the templates and their signed picture; Phase 4 supplies the email-safe tokens in `src/lib/email-tokens.ts` (`EMAIL_TOKENS`). The tables below are pinned against that module by `tests/unit/design-doc.test.ts`.

Rules:

- Literal hex only: mail clients cannot read CSS variables or blend `rgba`.
- Table-based layout, inline styles.
- System sans stack (LBC cannot load in mail).
- Logo hosted on `media.clickitstory.ae`.
- No web fonts, no tracking pixels.
- Copy, expiry, legal footer and sender line are Phase 5 / Koss.
- Light footer text is `#767676` (4.54:1 on the white card), as signed in the 05-q12-schemes picture.

### Light

| Role | Hex | Use |
|------|-----|-----|
| `page` | `#F4F4F4` | Page background |
| `card` | `#FFFFFF` | Card |
| `header` | `#090909` | Header band |
| `heading` | `#111111` | Heading text |
| `body` | `#333333` | Body text |
| `hint` | `#555555` | Hint text |
| `codeBox` | `#F6F6F6` | Code box background |
| `codeBorder` | `#E5E5E5` | Code box border |
| `code` | `#090909` | Code digits |
| `rule` | `#E5E5E5` | Divider |
| `footer` | `#767676` | Footer text |

### Dark

| Role | Hex | Use |
|------|-----|-----|
| `page` | `#090909` | Page background |
| `card` | `#101010` | Card |
| `cardBorder` | `#222222` | Card border |
| `header` | `#101010` | Header band |
| `headerRule` | `#222222` | Header divider |
| `heading` | `#F4F4F4` | Heading text |
| `body` | `#CCCCCC` | Body text |
| `hint` | `#A1A1A1` | Hint text |
| `codeBox` | `#191919` | Code box background |
| `codeBorder` | `#2A2A2A` | Code box border |
| `code` | `#ffcc00` | Code digits |
| `footer` | `#A1A1A1` | Footer text |

### Button (both schemes)

| Role | Value | Use |
|------|-------|-----|
| `bg` | `#ffcc00` | Button background |
| `ink` | `#090909` | Button text |
| `radius` | `999px` | Pill |
