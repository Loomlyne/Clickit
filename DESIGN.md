# Clickit Design System

## Direction

Clickit should feel like a premium streaming product: cinematic on the viewer side, calm and operational on the admin side.

- Viewer experience: immersive, content-led, dark cinematic, UAE cultural identity
- Admin experience: precise, dense, calm, tool-like
- Core rule: show artwork carries the expressive color; product chrome stays disciplined
- Hero layout anchors content bottom-left, cinematic, not centered

## Source of Truth

The look comes from UI System (github.com/Loomlyne/ui-system), seeded by `ui.config.json` at the repo root. Engine values were applied on 2026-10-20 to `src/styles/globals.css`. `--uis-*` aliases in `:root` exist for future UI System components and point at the existing tokens. To regenerate, re-run `buildTheme` on `ui.config.json` and re-apply the values.

## Mode and Color

- Dark mode only
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
| `--uis-primary-hover` | `#D7AD16` | Primary hover (UI System) |
| `--uis-primary-soft` | `#312915` | Soft primary tint (UI System) |

## Typography

- Local LBC font for titles, body and UI, in English and Arabic. The `modern` preset in `ui.config.json` is a placeholder until ui-system supports local fonts; no font comes from the engine.
- Logo mark: Arthead FREE for the "story" portion of the wordmark
- Type scale target: 11 overline / 13 label / 14 body-s / 16 body / 20 h3 / 24 h2 / 30 h1 / 36+ display
- Nothing under 11px

## Radius Roles

- Pill (999px): controls, chips, shell
- Field: 8px
- Card: 12px
- Media: 11px
- Panel: 16px

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
